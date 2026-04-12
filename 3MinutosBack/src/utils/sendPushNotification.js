const { Expo } = require('expo-server-sdk');

const expo = new Expo();

async function sendPushNotification({ to, title, body, data = {} }) {
  if (!Expo.isExpoPushToken(to)) {
    throw new Error('ExpoPushToken invalido');
  }

  const messages = [
    {
      to,
      sound: 'default',
      title,
      body,
      data,
    },
  ];

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];

  for (const chunk of chunks) {
    const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
    tickets.push(...ticketChunk);
  }

  console.log('[Push] tickets:', JSON.stringify(tickets, null, 2));

  return tickets;
}

module.exports = {
  sendPushNotification,
};