const cron = require('node-cron');
const UserDeliveryRun = require('./models/UserDeliveryRun');
const UserPreference = require('./models/UserPreference');
const { sendPushNotification } = require('./utils/sendPushNotification');

const APP_TIME_ZONE = 'America/Argentina/Buenos_Aires';

let isSendingNotifications = false;

async function sendPreparedDigestNotifications() {
  if (isSendingNotifications) {
    console.log('⏭️ Notificaciones omitidas: ya hay una corrida en curso');
    return;
  }

  isSendingNotifications = true;

  try {
    const runs = await UserDeliveryRun.find({
      status: 'prepared',
      notificationSentAt: null,
      digest: { $ne: null },
    })
      .sort({ preparedAt: 1, createdAt: 1 })
      .limit(100);

    if (!runs.length) {
      console.log('🔕 No hay corridas prepared pendientes de notificación');
      return;
    }

    console.log(`📬 Corridas pendientes de notificación: ${runs.length}`);

    for (const run of runs) {
  try {
    console.log(`\n📦 Procesando run ${run._id}`);
    console.log(`   userId: ${run.userId}`);
    console.log(`   deliveryDate: ${run.deliveryDate}`);
    console.log(`   deliveryTime: ${run.deliveryTime}`);
    console.log(`   notificationSentAt: ${run.notificationSentAt}`);

    const user = await UserPreference.findById(run.userId).lean();

    if (!user) {
      console.log(`⚠️ Usuario no encontrado para run ${run._id}`);
      continue;
    }

    console.log(`   user.name: ${user.name}`);
    console.log(`   user.isActive: ${user.isActive}`);
    console.log(`   expoPushToken: ${user.expoPushToken}`);

    if (!user.isActive) {
      console.log(`⚠️ Usuario inactivo para run ${run._id}`);
      continue;
    }

    if (!user.expoPushToken) {
      console.log(`⚠️ Usuario sin expoPushToken: ${user._id}`);
      continue;
    }

    const itemsCount = Array.isArray(run.digest?.digest?.items)
      ? run.digest.digest.items.length
      : 0;

    const title = 'Tu digest ya está listo';
    const body =
      itemsCount > 0
        ? `Ya tenés ${itemsCount} noticias nuevas en 3 Minutos.`
        : 'Ya tenés tu nuevo digest disponible.';

    console.log('   enviando push...');
    const tickets = await sendPushNotification({
      to: user.expoPushToken,
      title,
      body,
      data: {
        type: 'daily_digest',
        runId: String(run._id),
        userId: String(user._id),
        deliveryDate: run.deliveryDate,
        deliveryTime: run.deliveryTime,
      },
    });

    console.log('   tickets Expo:', JSON.stringify(tickets, null, 2));

    run.notificationSentAt = new Date();
    await run.save();

    console.log(`✅ Notificación enviada para run ${run._id}`);
  } catch (error) {
    console.error(`❌ Error enviando notificación para run ${run._id}:`, error.message);
  }
}
  } catch (error) {
    console.error('❌ Error general en sendPreparedDigestNotifications:', error.message);
  } finally {
    isSendingNotifications = false;
  }
}

function startSendPreparedDigestNotificationsJob() {
  cron.schedule(
    '*/5 * * * *',
    async () => {
      await sendPreparedDigestNotifications();
    },
    {
      timezone: APP_TIME_ZONE,
    }
  );
}

module.exports = {
  startSendPreparedDigestNotificationsJob,
  sendPreparedDigestNotifications,
};