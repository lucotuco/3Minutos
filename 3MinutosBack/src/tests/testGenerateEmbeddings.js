require('dotenv').config();
const mongoose = require('mongoose');
const UserPreference = require('../models/UserPreference');

async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Mongo conectado a:', mongoose.connection.name);
}

async function run() {
  await connectDB();

  const users = [
    {
      name: 'Lucas',
      topics: ['inflación argentina', 'boca juniors', 'turismo escapada buenos aires'],
      tone: 'especialista',
      deliveryTime: '08:00',
      isActive: true,
    },
    {
      name: 'Ana',
      topics: ['israel', 'netflix series estreno', 'plazo fijo inflación'],
      tone: 'cercano',
      deliveryTime: '15:00',
      isActive: true,
    },
    {
      name: 'Marcos',
      topics: ['milei', 'petróleo medio oriente', 'automotrices precios argentina'],
      tone: 'neutro',
      deliveryTime: '20:00',
      isActive: true,
    },
  ];

  const ops = users.map((user) => ({
    updateOne: {
      filter: { name: user.name },
      update: { $set: user },
      upsert: true,
    },
  }));

  const result = await UserPreference.bulkWrite(ops);

  console.log('✅ Seed ejecutado');
  console.log(result);

  const allUsers = await UserPreference.find({}).lean();
  allUsers.forEach((user) => {
    console.log(`- ${user.name} | ${user._id}`);
  });

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('❌ Error al insertar usuarios:', error);
  await mongoose.disconnect();
  process.exit(1);
});