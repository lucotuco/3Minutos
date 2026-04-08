require('dotenv').config();

const mongoose = require('mongoose');
const UserPreference = require('../models/UserPreference');
const { buildDigestForUser } = require('../utils/buildDigestForUser');
const { saveShownArticlesForUser } = require('../utils/saveShownArticlesForUser');

async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Mongo conectado a:', mongoose.connection.name);
}

async function run() {
  await connectDB();

  const user = await UserPreference.findOne({ isActive: true }).lean();

  if (!user) {
    throw new Error('No active user found');
  }

  const result = await buildDigestForUser(user._id);

  console.log(`\n👤 Usuario: ${result.user.name}`);
  console.log(`🎯 Tono: ${result.user.tone}`);
  console.log(`🕒 Horario: ${result.user.deliveryTime}`);
  console.log(`📌 Topics: ${result.user.topics.join(' | ')}`);

  result.digest.items.forEach((item, index) => {
    console.log(`\n${index + 1}. Topic: ${item.topic}`);

    if (!item.url) {
      console.log('   Sin resultado');
      return;
    }

    console.log(`   title: ${item.title}`);
    console.log(`   summary: ${item.summary}`);
    console.log(`   url: ${item.url}`);
  });

  await saveShownArticlesForUser(
    result.user.id,
    result.digest.items,
    result.user.tone
  );

  console.log('\n✅ Noticias guardadas como mostradas para ese usuario');

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});