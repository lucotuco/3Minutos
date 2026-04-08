const UserPreference = require('../models/UserPreference');
const UserDeliveryRun = require('../models/UserDeliveryRun');
const { buildDigestForUser } = require('./buildDigestForUser');
const {
  getLocalDateString,
  parseTimeToMinutes,
  getMinutesNow,
} = require('../utils/dateHelpers');

async function prepareUpcomingDeliveryRuns({
  minutesAhead = 10,
  now = new Date(),
} = {}) {
  const users = await UserPreference.find({
    isActive: true,
  }).lean();

  const nowMinutes = getMinutesNow(now);
  const maxMinutes = nowMinutes + minutesAhead;
  const deliveryDate = getLocalDateString(now);

  const usersInWindow = users.filter((user) => {
    const deliveryMinutes = parseTimeToMinutes(user.deliveryTime);
    if (deliveryMinutes === null) return false;

    return deliveryMinutes >= nowMinutes && deliveryMinutes <= maxMinutes;
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