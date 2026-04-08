const cron = require('node-cron');
const { prepareUpcomingDeliveryRuns } = require('./utils/prepareUpcomingDeliveryRuns.js');

function startPrepareDeliveryRunsJob() {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const now = new Date();
      console.log(`\n⏰ Ejecutando job de corridas: ${now.toLocaleString()}`);

      const results = await prepareUpcomingDeliveryRuns({
        minutesAhead: 10,
        now,
      });

      console.log('📦 Corridas preparadas:');
      console.log(JSON.stringify(results, null, 2));
    } catch (error) {
      console.error('❌ Error en prepareDeliveryRuns job:', error.message);
    }
  });
}

module.exports = {
  startPrepareDeliveryRunsJob,
};