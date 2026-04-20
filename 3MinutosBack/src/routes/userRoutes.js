const express = require('express');
const UserPreference = require('../models/UserPreference');
const UserShownArticle = require('../models/UserShownArticle');
const UserDeliveryRun = require('../models/UserDeliveryRun');
const { buildDigestForUser } = require('../utils/buildDigestForUser');
const { saveShownArticlesForUser } = require('../utils/saveShownArticlesForUser');
const { getLocalDateString } = require('../utils/dateHelpers');

const router = express.Router();

function normalizeTopics(topics) {
  if (!Array.isArray(topics)) return [];
  return topics
    .map((topic) => String(topic || '').trim())
    .filter(Boolean)
    .slice(0, 3);
}

function validateTone(tone) {
  const allowed = ['neutro', 'cercano', 'especialista', 'breve'];
  return allowed.includes(tone) ? tone : null;
}

function validateDeliveryTime(value) {
  return /^\d{2}:\d{2}$/.test(String(value || ''));
}

async function savePreparedDigestRun(user, digest, deliveryDate) {
  const now = new Date();

  return UserDeliveryRun.findOneAndUpdate(
    {
      userId: user._id,
      deliveryDate,
      deliveryTime: user.deliveryTime,
    },
    {
      $set: {
        status: 'prepared',
        digest,
        preparedAt: now,
        errorMessage: '',
        preferencesSnapshot: {
          topics: user.topics || [],
          tone: user.tone || 'neutro',
          deliveryTime: user.deliveryTime,
        },
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  ).lean();
}

async function triggerBackgroundDigestRefresh(user, deliveryDate) {
  try {
    const digest = await buildDigestForUser(user._id);
    await savePreparedDigestRun(user, digest, deliveryDate);
    console.log(
      `✅ Digest refrescado en background para ${user.name} (${user._id})`
    );
  } catch (error) {
    console.error(
      `❌ Error refrescando digest en background para ${user._id}:`,
      error.message
    );

    await UserDeliveryRun.findOneAndUpdate(
      {
        userId: user._id,
        deliveryDate,
        deliveryTime: user.deliveryTime,
      },
      {
        $set: {
          status: 'error',
          errorMessage: error.message || 'Background digest refresh failed',
          preferencesSnapshot: {
            topics: user.topics || [],
            tone: user.tone || 'neutro',
            deliveryTime: user.deliveryTime,
          },
        },
      },
      {
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );
  }
}

router.post('/preferences', async (req, res) => {
  try {
    const {
      name = '',
      topics = [],
      tone = 'neutro',
      deliveryTime = '08:00',
      isActive = true,
    } = req.body || {};

    const cleanName = String(name).trim();
    const cleanTopics = normalizeTopics(topics);
    const cleanTone = validateTone(tone);

    if (!cleanName) {
      return res.status(400).json({ error: 'name is required' });
    }

    if (cleanTopics.length !== 3) {
      return res.status(400).json({ error: 'topics must contain exactly 3 items' });
    }

    if (!cleanTone) {
      return res.status(400).json({ error: 'invalid tone' });
    }

    if (!validateDeliveryTime(deliveryTime)) {
      return res.status(400).json({ error: 'invalid deliveryTime format, expected HH:MM' });
    }

    const user = await UserPreference.create({
      name: cleanName,
      topics: cleanTopics,
      tone: cleanTone,
      deliveryTime,
      isActive: Boolean(isActive),
    });

    return res.status(201).json(user);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to create preferences' });
  }
});

router.get('/preferences/:userId', async (req, res) => {
  try {
    const user = await UserPreference.findById(req.params.userId).lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(user);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch preferences' });
  }
});

router.patch('/preferences/:userId', async (req, res) => {
  try {
    const updates = {};
    const { name, topics, tone, deliveryTime, isActive } = req.body || {};

    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (!cleanName) {
        return res.status(400).json({ error: 'name cannot be empty' });
      }
      updates.name = cleanName;
    }

    if (topics !== undefined) {
      const cleanTopics = normalizeTopics(topics);
      if (cleanTopics.length !== 3) {
        return res.status(400).json({ error: 'topics must contain exactly 3 items' });
      }
      updates.topics = cleanTopics;
    }

    if (tone !== undefined) {
      const cleanTone = validateTone(tone);
      if (!cleanTone) {
        return res.status(400).json({ error: 'invalid tone' });
      }
      updates.tone = cleanTone;
    }

    if (deliveryTime !== undefined) {
      if (!validateDeliveryTime(deliveryTime)) {
        return res.status(400).json({ error: 'invalid deliveryTime format, expected HH:MM' });
      }
      updates.deliveryTime = deliveryTime;
    }

    if (isActive !== undefined) {
      updates.isActive = Boolean(isActive);
    }

    const user = await UserPreference.findByIdAndUpdate(
      req.params.userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(user);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to update preferences' });
  }
});

router.get('/:userId/digest', async (req, res) => {
  try {
    const user = await UserPreference.findById(req.params.userId).lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(400).json({ error: 'User is inactive' });
    }

    const deliveryDate = getLocalDateString(new Date());

    const todaysPreparedRun = await UserDeliveryRun.findOne({
      userId: user._id,
      deliveryDate,
      status: 'prepared',
      digest: { $ne: null },
    })
      .sort({ preparedAt: -1, createdAt: -1 })
      .lean();

    if (todaysPreparedRun?.digest) {
      return res.json(todaysPreparedRun.digest);
    }

    const latestPreparedRun = await UserDeliveryRun.findOne({
      userId: user._id,
      status: 'prepared',
      digest: { $ne: null },
    })
      .sort({ preparedAt: -1, createdAt: -1 })
      .lean();

    if (latestPreparedRun?.digest) {
      triggerBackgroundDigestRefresh(user, deliveryDate);
      return res.json(latestPreparedRun.digest);
    }

    const digest = await buildDigestForUser(req.params.userId);
    await savePreparedDigestRun(user, digest, deliveryDate);

    return res.json(digest);
  } catch (error) {
    if (error.message === 'User not found') {
      return res.status(404).json({ error: error.message });
    }

    if (error.message === 'User is inactive') {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({ error: error.message || 'Failed to build digest' });
  }
});

router.post('/:userId/digest/refresh', async (req, res) => {
  try {
    const user = await UserPreference.findById(req.params.userId).lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(400).json({ error: 'User is inactive' });
    }

    const deliveryDate = getLocalDateString(new Date());
    const digest = await buildDigestForUser(req.params.userId);

    await savePreparedDigestRun(user, digest, deliveryDate);

    return res.json(digest);
  } catch (error) {
    if (error.message === 'User not found') {
      return res.status(404).json({ error: error.message });
    }

    if (error.message === 'User is inactive') {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({ error: error.message || 'Failed to refresh digest' });
  }
});

router.post('/:userId/digest/mark-shown', async (req, res) => {
  try {
    const user = await UserPreference.findById(req.params.userId).lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { items = [], tone = user.tone || 'neutro', shownDate } = req.body || {};

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'items must be an array' });
    }

    const effectiveShownDate = shownDate || getLocalDateString(new Date());

    await saveShownArticlesForUser(user._id, items, {
      tone,
      shownDate: effectiveShownDate,
    });

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to mark shown articles' });
  }
});

router.get('/:userId/shown-articles', async (req, res) => {
  try {
    const user = await UserPreference.findById(req.params.userId).lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const articles = await UserShownArticle.find({ userId: user._id })
      .sort({ shownAt: -1, createdAt: -1 })
      .lean();

    return res.json(articles);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch shown articles' });
  }
});

router.patch('/preferences/:userId/push-token', async (req, res) => {
  try {
    const { expoPushToken } = req.body || {};

    if (!expoPushToken || typeof expoPushToken !== 'string') {
      return res.status(400).json({ error: 'expoPushToken is required' });
    }

    const user = await UserPreference.findByIdAndUpdate(
      req.params.userId,
      { $set: { expoPushToken } },
      { new: true }
    ).lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to save push token' });
  }
});

module.exports = router;