const cron = require('node-cron');
const path = require('path');
const { spawn } = require('child_process');
const { APP_TIME_ZONE } = require('./utils/dateHelpers');

let isIngestionRunning = false;

function formatArgentinaDateTime(date = new Date()) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: APP_TIME_ZONE,
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(date);
}

function runScript(scriptRelativePath, label) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, scriptRelativePath);

    const child = spawn(process.execPath, [scriptPath], {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('error', (error) => {
      reject(new Error(`${label}: ${error.message}`));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${label} terminó con código ${code}`));
    });
  });
}

async function runHourlyIngestion() {
  if (isIngestionRunning) {
    console.log('⏭️ Ingesta omitida: todavía hay una corrida en curso');
    return;
  }

  isIngestionRunning = true;

  try {
    console.log(`\n📰 Iniciando ingesta horaria (AR): ${formatArgentinaDateTime(new Date())}`);

    await runScript('ingestion/runRssIngestion.js', 'RSS ingestion');
    await runScript('ingestion/runNewsApiIngestion.js', 'NewsAPI ingestion');

    console.log('✅ Ingesta horaria completada');
  } catch (error) {
    console.error('❌ Error en ingesta horaria:', error.message);
  } finally {
    isIngestionRunning = false;
  }
}

function startHourlyIngestionJob() {
  cron.schedule(
    '/10 * * * *',
    async () => {
      await runHourlyIngestion();
    },
    {
      timezone: APP_TIME_ZONE,
    }
  );
}

module.exports = {
  startHourlyIngestionJob,
  runHourlyIngestion,
};