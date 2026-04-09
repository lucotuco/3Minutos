const express = require('express');
const UserPreference = require('../models/UserPreference');
const UserShownArticle = require('../models/UserShownArticle');
const UserDeliveryRun = require('../models/UserDeliveryRun');
const { buildDigestForUser } = require('../utils/buildDigestForUser');
const { saveShownArticlesForUser } = require('../utils/saveShownArticlesForUser');
const {
  getLocalDateString,
  getMinutesNow,
  parseTimeToMinutes,
} = require('../utils/dateHelpers');

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

    const deliveryDate = getLocalDateString();

    const existingRun = await UserDeliveryRun.findOne({
      userId: user._id,
      deliveryDate,
      deliveryTime: user.deliveryTime,
      status: 'prepared',
      digest: { $ne: null },
    }).lean();

    if (existingRun && existingRun.digest) {
      return res.json(existingRun.digest);
    }

    const result = await buildDigestForUser(req.params.userId);
    return res.json(result);
    await saveShownArticlesForUser(user._id, result.digest.items || [], user.tone);
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

    const now = new Date();
    const today = getLocalDateString(now);
    const nowMinutes = getMinutesNow(now);
    const deliveryMinutes = parseTimeToMinutes(user.deliveryTime);

    const result = await buildDigestForUser(req.params.userId);

    const targetDate =
      deliveryMinutes !== null && nowMinutes > deliveryMinutes
        ? getLocalDateString(new Date(now.getTime() + 24 * 60 * 60 * 1000))
        : today;

    

    await UserDeliveryRun.findOneAndUpdate(
      {
        userId: user._id,
        deliveryDate: targetDate,
        deliveryTime: user.deliveryTime,
      },
      {
        $set: {
          userId: user._id,
          deliveryDate: targetDate,
          deliveryTime: user.deliveryTime,
          status: 'prepared',
          digest: result,
          preparedAt: new Date(),
          errorMessage: '',
        },
      },
      {
        upsert: true,
        returnDocument: 'after',
      }
    );

    return res.json(result);
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

router.get('/:userId/shown-articles', async (req, res) => {
  try {
    const items = await UserShownArticle.find({
      userId: req.params.userId,
    })
      .sort({ shownAt: -1 })
      .lean();

    return res.json(items);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch shown articles' });
  }
});

module.exports = router;