require('dotenv').config();
const mongoose = require('mongoose');
const { buildUserNewsDigest } = require('../utils/buildUserNewsDigest');

async function connectDB() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
}

// Los 3 perfiles que ponen a prueba el 100% de la arquitectura
const TEST_PROFILES = [
{
    name: ' Perfil 15:',
    topics: ["Fútbol", "Política", "Avistamiento de Ovnis"] 
  },
  {
    name: ' Perfil 16:',
    topics: ["Dólar y Mercados", "Tecnología", "Startups Argentinas"] 
  },
  {
    name: ' Perfil 17:',
    topics: ["Salud", "Medio Oriente", "Recetas Veganas"] 
  },
  {
    name: ' Perfil 18:',
    topics: ["Cine y Series", "Música", "Ley de Alquileres"] 
  }
];

async function runBattery() {
  await connectDB();
  console.log('\n⚡ INICIANDO BATERÍA DE PRUEBAS DE ENTREGA...\n' + '='.repeat(60));

  let totalTests = 0;
  let passedTests = 0;

  for (const profile of TEST_PROFILES) {
    console.log(`\n▶️  Ejecutando: ${profile.name}`);
    
    const startTime = Date.now();
    const digest = await buildUserNewsDigest({
      topics: profile.topics,
      alreadyShownUrls: [],
      alreadyShownTitles: [],
      perTopicLimit: 10,
    });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    const seenUrls = new Set();
    const seenTitles = new Set();
    let profilePassed = true;

    console.log(`⏱️  Tiempo de respuesta: ${elapsed}s | Noticias entregadas: ${digest.items.length}/3`);

    digest.items.forEach((item, idx) => {
      totalTests++;
      const num = idx + 1;
      const title = item.title || 'SIN TÍTULO';
      const score = Number(item.rankingScore ?? item.finalScore ?? item.score ?? 0);
      const category = item.category || 'Sin categoría';

      console.log(`\n   📰 Noticia ${num} [Tópico: "${item.topic}"]`);
      console.log(`      Título: "${title.slice(0, 70)}..."`);
      console.log(`      Categoría: ${category} | Puntaje: ${score}`);

      // 🛡️ EVALUACIÓN AUTOMÁTICA DE ERRORES:
      const errors = [];

      // 1. Chequeo de Score 0
      if (score === 0) errors.push('Puntaje en 0 (Falta enrichArticleRanking)');
      
      // 2. Chequeo de Categoría Inexistente
      if (category === 'General') errors.push('Cayó en categoría "General" (Fallo de fallback)');
      
      // 3. Chequeo de Duplicados en la misma corrida
      if (item.url && seenUrls.has(item.url)) errors.push('URL duplicada en el mismo resumen');
      if (seenTitles.has(title)) errors.push('Título duplicado en el mismo resumen');

      // 4. Chequeo de Corral Deportivo (Si pidió fútbol, no puede dar policiales)
      if (['river', 'champions league', 'rugby femenino'].includes(item.topic) && category !== 'Deportes') {
        errors.push(`Violación de corral: Pidió deporte pero entregó categoría "${category}"`);
      }

      if (errors.length > 0) {
        profilePassed = false;
        errors.forEach(e => console.log(`      ❌ ERROR: ${e}`));
      } else {
        passedTests++;
        console.log(`      ✅ ESTADO: Óptimo y validado`);
      }

      if (item.url) seenUrls.add(item.url);
      seenTitles.add(title);
    });

    console.log('-'.repeat(60));
  }

  console.log(`\n📊 RESULTADO FINAL DE LA AUDITORÍA:`);
  console.log(`   Noticias evaluadas: ${totalTests}`);
  console.log(`   Éxitos: ${passedTests} | Fallos: ${totalTests - passedTests}`);
  
  if (passedTests === totalTests) {
    console.log(`\n🏆 ¡TODO PERFECTO! El algoritmo está listo para producción al 100%.\n`);
  } else {
    console.log(`\n⚠️ SE DETECTARON FALLOS. Revisá los ítems marcados con ❌ arriba.\n`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

runBattery().catch(err => {
  console.error('❌ Error fatal en la batería de pruebas:', err);
  process.exit(1);
});