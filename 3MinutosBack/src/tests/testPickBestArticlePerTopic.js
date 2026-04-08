const mongoose = require('mongoose');
const { buildUserNewsDigest } = require('../utils/buildUserNewsDigest');

async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Mongo conectado a:', mongoose.connection.name);
}

async function run() {
  await connectDB();

  const digest = await buildUserNewsDigest({
    topics: [
      'milei ',
      'boca juniors',
      'israel',
    ],
    tone: 'especialista',
    alreadyShownUrls: [],
    perTopicLimit: 10,
    numCandidates: 100,
  });

  digest.items.forEach((item, index) => {
    console.log(`\n${index + 1}. Topic: ${item.topic}`);

    if (!item.url) {
      console.log('   Sin resultado');
      return;
    }

    console.log(`   title: ${item.title}`);
    console.log(`   section: ${item.section}`);
    console.log(`   region: ${item.region}`);
    console.log(`   tags: ${item.tags.join(', ')}`);
    console.log(`   score: ${item.score}`);
    console.log(`   finalScore: ${item.finalScore}`);
    console.log(`   cached: ${item.cached ? 'sí' : 'no'}`);
    console.log(`   summary: ${item.summary}`);
    console.log(`   url: ${item.url}`);
  });

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});