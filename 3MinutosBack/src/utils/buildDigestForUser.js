const UserPreference = require('../models/UserPreference');
const { buildUserNewsDigest } = require('./buildUserNewsDigest');
const { getAlreadyShownUrlsForUser } = require('./getAlreadyShownUrlsForUser');

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
    tone: user.tone || 'neutro',
    alreadyShownUrls,
    perTopicLimit: 10,
    numCandidates: 100,
  });

  return {
    user: {
      id: String(user._id),
      name: user.name,
      tone: user.tone,
      deliveryTime: user.deliveryTime,
      topics: user.topics || [],
    },
    digest,
  };
}

module.exports = {
  buildDigestForUser,
};