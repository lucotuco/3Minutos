const UserPreference = require('../models/UserPreference');
const UserDeliveryRun = require('../models/UserDeliveryRun');
const { buildDigestForUser } = require('./buildDigestForUser');
const {
  getLocalDateString,
  parseTimeToMinutes,
  getMinutesNow,
} = require('../utils/dateHelpers');

function isMinutesInWindow(deliveryMinutes, nowMinutes, minutesAhead) {
  if (deliveryMinutes === null) return false;

  const endMinutes = (nowMinutes + minutesAhead) % 1440;

  if (nowMinutes <= endMinutes) {
    return deliveryMinutes >= nowMinutes && deliveryMinutes <= endMinutes;
  }

  return deliveryMinutes >= nowMinutes || deliveryMinutes <= endMinutes;
}

async function prepareUpcomingDeliveryRuns({
  minutesAhead = 10,
  now = new Date(),
} = {}) {
  const users = await UserPreference.find({
    isActive: true,
  }).lean();

  const nowMinutes = getMinutesNow(now);
  const deliveryDate = getLocalDateString(now);

  const usersInWindow = users.filter((user) => {
    const deliveryMinutes = parseTimeToMinutes(user.deliveryTime);
    return isMinutesInWindow(deliveryMinutes, nowMinutes, minutesAhead);
  });

  const results = [];

  for (const user of usersInWindow) {
    const existing = await UserDeliveryRun.findOne({
      userId: user._id,
      deliveryDate,
      deliveryTime: user.deliveryTime,
    });

    if (existing) {
      results.push({
        userId: String(user._id),
        name: user.name,
        deliveryTime: user.deliveryTime,
        created: false,
        status: existing.status,
        runId: String(existing._id),
      });
      continue;
    }

    try {
      const digest = await buildDigestForUser(user._id);

      const run = await UserDeliveryRun.create({
        userId: user._id,
        deliveryDate,
        deliveryTime: user.deliveryTime,
        status: 'prepared',
        digest,
        preferencesSnapshot: {
          topics: user.topics || [],
          deliveryTime: user.deliveryTime,
        },
        preparedAt: new Date(),
      });

      results.push({
        userId: String(user._id),
        name: user.name,
        deliveryTime: user.deliveryTime,
        created: true,
        status: run.status,
        runId: String(run._id),
      });
    } catch (error) {
      const run = await UserDeliveryRun.create({
        userId: user._id,
        deliveryDate,
        deliveryTime: user.deliveryTime,
        status: 'error',
        preferencesSnapshot: {
          topics: user.topics || [],
          deliveryTime: user.deliveryTime,
        },
        errorMessage: error.message || 'Unknown prepare error',
      });

      results.push({
        userId: String(user._id),
        name: user.name,
        deliveryTime: user.deliveryTime,
        created: false,
        status: run.status,
        runId: String(run._id),
        errorMessage: run.errorMessage,
      });
    }
  }

  return results;
}

module.exports = {
  prepareUpcomingDeliveryRuns,
};