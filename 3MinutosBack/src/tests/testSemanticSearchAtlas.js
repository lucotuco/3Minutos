require('dotenv').config();

const mongoose = require('mongoose');
const { prepareUpcomingDeliveryRuns } = require('../utils/prepareUpcomingDeliveryRuns');

async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Mongo conectado a:', mongoose.connection.name);
}

async function run() {
  await connectDB();

  const results = await prepareUpcomingDeliveryRuns({
    minutesAhead: 10,
  });

  console.log('\n📦 Corridas preparadas:\n');
  console.log(JSON.stringify(results, null, 2));

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});