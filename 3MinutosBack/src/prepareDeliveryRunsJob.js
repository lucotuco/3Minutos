const cron = require('node-cron');
const { prepareUpcomingDeliveryRuns } = require('./utils/prepareUpcomingDeliveryRuns.js');
const {
  APP_TIME_ZONE,
  getLocalDateString,
  getMinutesNow,
} = require('./utils/dateHelpers');

function formatArgentinaDateTime(date = new Date()) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: APP_TIME_ZONE,
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(date);
}

function formatArgentinaHour(date = new Date()) {
  const totalMinutes = getMinutesNow(date);
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function startPrepareDeliveryRunsJob() {
  cron.schedule(
    '*/5 * * * *',
    async () => {
      try {
        const now = new Date();

        console.log(`\n⏰ Ejecutando job de corridas (AR): ${formatArgentinaDateTime(now)}`);
        console.log(`🗓 Fecha AR: ${getLocalDateString(now)}`);
        console.log(`🕒 Hora AR: ${formatArgentinaHour(now)}`);
        console.log(`🌍 TZ usada: ${APP_TIME_ZONE}`);

        const results = await prepareUpcomingDeliveryRuns({
          minutesAhead: 10,
          now,
        });

        console.log('📦 Corridas preparadas:');
        console.log(JSON.stringify(results, null, 2));
      } catch (error) {
        console.error('❌ Error en prepareDeliveryRuns job:', error.message);
      }
    },
    {
      timezone: APP_TIME_ZONE,
    }
  );
}

module.exports = {
  startPrepareDeliveryRunsJob,
};