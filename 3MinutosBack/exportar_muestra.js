require('dotenv').config();
const fs = require('fs');
const mongoose = require('mongoose');
const Article = require('./src/models/Article');

async function exportarMuestra() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB...');

    // Buscamos solo noticias de los últimos 2 días para ver la data fresca
    const dosDiasAtras = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    const articulos = await Article.find({ publishedAt: { $gte: dosDiasAtras } })
      .select('title sourceName country category topic tags importanceScore publishedAt geoScope topicStatus topicError ')
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();

    fs.writeFileSync('muestra_auditoria.json', JSON.stringify(articulos, null, 2));
    
    console.log(`✅ Archivo 'muestra_auditoria.json' generado con éxito con ${articulos.length} noticias.`);
  } catch (error) {
    console.error('❌ Error exportando la muestra:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

exportarMuestra();