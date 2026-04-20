const path = require('path');
const fs = require('fs');
const os = require('os');

const UserPreference = require('../models/UserPreference');
const UserDeliveryRun = require('../models/UserDeliveryRun');
const { buildUserNewsDigest } = require('./buildUserNewsDigest');
const { getAlreadyShownUrlsForUser } = require('./getAlreadyShownUrlsForUser');
const { getLocalDateString } = require('./dateHelpers');

const { buildDigestAudioScript } = require('../audio/buildDigestAudioScript');
const { generateDigestAudioFile } = require('../audio/generateDigestAudioFile');
const { uploadDigestAudio } = require('../audio/uploadDigestAudio');
const { deleteDigestAudio } = require('../audio/deleteDigestAudio');

async function buildDigestForUser(userId) {
  const user = await UserPreference.findById(userId).lean();

  if (!user) {
    throw new Error('User not found');
  }

  if (!user.isActive) {
    throw new Error('User is inactive');
  }

  const alreadyShownUrls = await getAlreadyShownUrlsForUser(userId);

  const digest = await buildUserNewsDigest({
    topics: user.topics || [],
    alreadyShownUrls,
    perTopicLimit: 10,
    numCandidates: 100,
  });

  const today = getLocalDateString(new Date());

  const previousRun = await UserDeliveryRun.findOne({
    userId: user._id,
    status: 'prepared',
    'digest.audioStorageKey': { $exists: true, $ne: null },
  })
    .sort({ preparedAt: -1, createdAt: -1 })
    .lean();

  const script = buildDigestAudioScript({
    userName: user.name,
    items: digest.items || [],
  });

  const tempFilePath = path.join(os.tmpdir(), `digest-${user._id}-${Date.now()}.mp3`);
  const storageKey = `digests-audio/${today}/user-${user._id}`;

  await generateDigestAudioFile({
    script,
    outputPath: tempFilePath,
  });

  const { audioUrl, audioStorageKey } = await uploadDigestAudio(tempFilePath, storageKey);

  if (fs.existsSync(tempFilePath)) {
    fs.unlinkSync(tempFilePath);
  }

  if (
    previousRun?.digest?.audioStorageKey &&
    previousRun.digest.audioStorageKey !== audioStorageKey
  ) {
    await deleteDigestAudio(previousRun.digest.audioStorageKey);
  }

  return {
    user: {
      id: String(user._id),
      name: user.name,
      deliveryTime: user.deliveryTime,
      topics: user.topics || [],
    },
    digest: {
      items: digest.items || [],
      audioUrl,
      audioStorageKey,
      audioGeneratedAt: new Date().toISOString(),
    },
  };
}

module.exports = {
  buildDigestForUser,
};