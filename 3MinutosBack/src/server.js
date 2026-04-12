require('dotenv').config();

const app = require('./app');
const mongoose = require('mongoose');
const { startPrepareDeliveryRunsJob } = require('./prepareDeliveryRunsJob');
const { startHourlyIngestionJob, runHourlyIngestion } = require('./ingestionJob');

const PORT = process.env.PORT || 3000;

async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Mongo conectado');
  console.log('✅ Base actual:', mongoose.connection.name);
}

async function start() {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });

    startPrepareDeliveryRunsJob();
    console.log('🕒 Job de corridas programado cada 5 minutos');

    startHourlyIngestionJob();
    console.log('📰 Job de ingesta programado cada hora');

    if (process.env.RUN_INGESTION_ON_BOOT === 'true') {
      console.log('⚡ Ejecutando ingesta inicial al arrancar...');
      runHourlyIngestion().catch((error) => {
        console.error('❌ Error en ingesta inicial:', error.message);
      });
    }
  } catch (error) {
    console.error('❌ Error al iniciar servidor:', error.message);
    process.exit(1);
  }
}

start();