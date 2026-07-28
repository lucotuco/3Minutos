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
    name: '⚽ Perfil 1: Apodos y Jerga de Fútbol Argentino',
    topics: ['chiqui tapia', 'muñeco gallardo', 'racing club'],
  },
  {
    name: '🏆 Perfil 2: Copas, Torneos y Selección',
    topics: ['copa libertadores', 'scaloni', 'bombonera'],
  },

  // ============================================================================
  // 🏛️ GRUPO 2: NOMBRES PROPIOS DE LA POLÍTICA
  // ============================================================================
  // Desafío: Evaluar que los apellidos sueltos expandan a debates legislativos
  // o gestión pública actual (2026), manteniendo un neutralityScore > 85.
  {
    name: '🏛️ Perfil 3: Líderes y Gobernadores',
    topics: ['kicillof', 'villarruel', 'macri'],
  },
  {
    name: '⚖️ Perfil 4: Agenda Institucional y Justicia',
    topics: ['corte suprema', 'congreso', 'gremios'],
  },

  // ============================================================================
  // 💸 GRUPO 3: MICROECONOMÍA Y FINANZAS DE BOLSILLO
  // ============================================================================
  // Desafío: Separar la economía de calle (alquileres, nafta, tarifas) de la
  // timba financiera (dólar blue, plazos fijos, MEP), evitando notas duplicadas.
  {
    name: '🛒 Perfil 5: Finanzas Cotidianas y Bolsillo',
    topics: ['plazo fijo', 'dolar blue', 'alquileres'],
  },
  {
    name: '📊 Perfil 6: Precios de la Calle y Tarifas',
    topics: ['nafta', 'prepagas', 'tarifas luz'],
  },

  // ============================================================================
  // 🏢 GRUPO 4: MARCAS, EMPRESAS Y CONSUMO MASIVO
  // ============================================================================
  // Desafío: Ver cómo el motor busca noticias corporativas, balances o balances
  // empresariales sin caer en notas publicitarias vacías.
  {
    name: '🏢 Perfil 7: Empresas y Negocios Argentinos',
    topics: ['mercado libre', 'ypf', 'aerolineas argentinas'],
  },

  // ============================================================================
  // 🏎️ GRUPO 5: DEPORTES FUERA DEL FÚTBOL
  // ============================================================================
  // Desafío: Auditar que "colapinto" expanda a F1/automovilismo 2026 y no se
  // mezcle con fútbol en el corral de categorías.
  {
    name: '🏎️ Perfil 8: Motor, Tenis y Atletas Globales',
    topics: ['colapinto', 'formula 1', 'djokovic'],
  },

  // ============================================================================
  // 📺 GRUPO 6: CULTURA VIRAL, STREAMERS Y CHIMENTOS
  // ============================================================================
  // Desafío: Poner a prueba el filtro anti-clickbait y la traducción del
  // portugués (muy común en noticias de farándula o espectáculos importados).
  {
    name: '📺 Perfil 9: Chimentos, Realities y Redes',
    topics: ['susana gimenez', 'streamers', 'lollapalooza'],
  },

  // ============================================================================
  // 🧬 GRUPO 7: CIENCIA, SALUD Y TECH DE PUNTA
  // ============================================================================
  // Desafío: Auditar que guessCategoryForTopic guíe "dengue" o "salud mental"
  // a Sociedad/Bienestar, y "chatgpt" a Tecnología sin fallbacks insólitos.
  {
    name: '🧬 Perfil 10: Salud Pública y Tech Avanzada',
    topics: ['dengue', 'salud mental', 'chatgpt'],
  },

  // ============================================================================
  // 🔀 GRUPO 8: PALABRAS AMBIGUAS O DE DOBLE SENTIDO (¡El Test Supremo!)
  // ============================================================================
  // Desafío: "copa" (¿torneo o bebida?), "banco" (¿entidad financiera o suplentes?),
  // "redes" (¿sociales o eléctricas/pesca?). Ver cómo actúa el system prompt.
  {
    name: '🔀 Perfil 11: Palabras Ambiguas y Homónimos',
    topics: ['copa', 'banco', 'redes'],
  },

  // ============================================================================
  // 👤 GRUPO 9: EL USUARIO REALISTA PROMEDIO
  // ============================================================================
  // Desafío: El mix clásico que elegirá el 80% de tus usuarios al abrir la app.
  {
    name: '🎯 Perfil 12: El Mix Realista Argentino',
    topics: ['river', 'dolar mep', 'netflix'],
  },
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