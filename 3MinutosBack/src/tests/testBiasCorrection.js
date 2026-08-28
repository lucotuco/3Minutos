require('dotenv').config();
const mongoose = require('mongoose');
const Article = require('../models/Article');
const { generateNeutralCuration } = require('../curation/generateNeutralCuration');

async function testBiasCorrection() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Conectado a MongoDB\n');

  // 1. Creamos una noticia falsa con sesgo político extremo
  const mockArticle = await Article.create({
    sourceName: 'Portal Militante',
    sourceUrl: 'http://test.com',
    url: `http://test.com/fake-news-${Date.now()}`,
    title: 'El despiadado ajuste del Gobierno destruye a los trabajadores con tarifazos salvajes',
    rawSummary: 'En otra medida insensible y brutal, el presidente firmó un decreto que aniquila el bolsillo de las familias. El plan motosierra avanza sin piedad sobre la clase media, demostrando el desprecio total por el pueblo.',
    contentSnippet: 'En otra medida insensible y brutal...',
    category: 'Política',
    topic: 'Gobierno Nacional',
    geoScope: 'Argentina',
    publishedAt: new Date()
  });

  console.log('📰 TEXTO ORIGINAL (SESGADO):');
  console.log(`   Título: "${mockArticle.title}"`);
  console.log(`   Resumen: "${mockArticle.rawSummary}"\n`);
  console.log('⏳ Procesando con IA (Cadena de Pensamiento)...\n');

  try {
    // 2. Forzamos la curación neutral
    const result = await generateNeutralCuration(mockArticle._id, { force: true });

    // 3. Mostramos el razonamiento interno y el resultado final
    console.log('🧠 ANÁLISIS DE LA IA (Cadena de Pensamiento):');
    console.log(`   Nivel de Riesgo: [${result.politicalBiasRisk.toUpperCase()}]`);
    console.log(`   Razonamiento: "${result.article.biasAnalysis}"\n`);

    console.log('⚖️ RESULTADO FINAL (NEUTRALIZADO):');
    console.log(`   Título: "${result.neutralTitle}"`);
    console.log(`   Copete: "${result.neutralLead}"`);
    console.log(`   Resumen: "${result.neutralSummary}"`);
    console.log(`   Puntaje de Neutralidad: ${result.neutralityScore}/100\n`);

  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
  } finally {
    // 4. Limpiamos la base de datos y cerramos
    await Article.findByIdAndDelete(mockArticle._id);
    await mongoose.disconnect();
  }
}

testBiasCorrection();