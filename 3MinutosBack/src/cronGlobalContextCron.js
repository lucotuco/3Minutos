const cron = require('node-cron');
const { generateDailyContext } = require('./ingestion/generateDailyContext');

function startGlobalContextCron() {
  // Expresión Cron: "0 6,18 * * *" -> Se ejecuta a las 06:00 AM y a las 18:00 PM todos los días.
  // Podés ajustar los horarios según el huso horario de tu servidor o el pico de tráfico de tus usuarios.
  cron.schedule('0 6,18 * * *', async () => {
    console.log('\n⏰ [CRON] Iniciando generación automática del Contexto Global...');
    const startTime = Date.now();
    
    try {
      await generateDailyContext();
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ [CRON] Contexto Global actualizado con éxito en ${duration}s.`);
    } catch (error) {
      console.error('❌ [CRON] Falló la generación del Contexto Global:', error);
    }
  }, {
    scheduled: true,
    timezone: "America/Argentina/Buenos_Aires" // Asegura que corra en hora local argentina
  });

  console.log('🚀 [CRON] Tarea de Contexto Global programada (06:00 AM y 18:00 PM - ART).');
}

module.exports = { startGlobalContextCron };