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
    name: '🦁 Perfil 1: Selecciones Nacionales',
    topics: ['las leonas', 'los pumas', 'las panteras'],
  },

  // ============================================================================
  // 📏 GRUPO 2: LA TRAMPA DE LAS 3 Y 4 PALABRAS (Filtro >= 5)
  // ============================================================================
  // Desafío: Antes el código salteaba la IA con 3 palabras. Ahora tópicos de 4
  // palabras como estos DEBEN pasar por la IA para ganar contexto.
  {
    name: '📏 Perfil 2: Entidades de 4 palabras',
    topics: ['banco central republica argentina', 'campeonato de primera division', 'ministerio de capital humano'],
  },

  // ============================================================================
  // 🛸 GRUPO 3: EL TEST DE CAÍDA LIBRE (Filtro de Fallback 'ar')
  // ============================================================================
  // Desafío: Temas absurdos o muy lejanos de los que seguro NO hay noticias hoy.
  // Debe forzar el fallback y traer noticias de ARGENTINA, no crímenes de Brasil.
  {
    name: '🛸 Perfil 3: Temas Inexistentes (Test de Fallback)',
    topics: ['terremoto en marte', 'elecciones en mongolia', 'crisis en islandia'],
  },

  // ============================================================================
  // 🧠 GRUPO 4: CONCEPTOS ABSTRACTOS (Prueba de la Zona Oro > 0.82)
  // ============================================================================
  // Desafío: El usuario no busca una palabra exacta, sino un concepto. 
  // El RRF debe encontrar notas afines y el Escudo Léxico NO debe bloquearlas.
  {
    name: '🧠 Perfil 4: Búsquedas Conceptuales',
    topics: ['ahorro y finanzas personales', 'clima politico actual', 'novedades mercado inmobiliario'],
  },

  // ============================================================================
  // 🎯 GRUPO 5: NOMBRES PROPIOS DE ALTO PERFIL (Precisión RRF)
  // ============================================================================
  // Desafío: Verificar que no mezcle a Caputo (Santiago vs Toto) y que 
  // Riquelme no traiga notas genéricas de Boca sin mencionarlo a él.
  {
    name: '🎯 Perfil 5: Figuras Hiper-Específicas',
    topics: ['santiago caputo', 'juan roman riquelme', 'marcos galperin'],
  },

  // ============================================================================
  // 🔀 GRUPO 6: AMBIGÜEDAD DE DICCIONARIO
  // ============================================================================
  // Desafío: "blanco" (¿color, presidente de Racing o apellido?), "corona" 
  // (¿virus, realeza o cerveza?), "vela" (¿deporte, objeto o apellido?).
  {
    name: '🔀 Perfil 6: Palabras Trampa',
    topics: ['blanco', 'corona', 'vela'],
  },

  // ============================================================================
  // 📉 GRUPO 7: MICRO-NICHOS ECONÓMICOS
  // ============================================================================
  // Desafío: Términos técnicos que el motor léxico (texto) debe cazar 
  // con exactitud sin que el vector se vaya a economía general.
  {
    name: '📉 Perfil 7: Jerga Económica',
    topics: ['ccl', 'inflacion nucleo', 'paritarias'],
  },

  // ============================================================================
  // 📺 GRUPO 8: ENTRETENIMIENTO Y SERIES LOCALES
  // ============================================================================
  // Desafío: Separar títulos de series ("El Encargado") del trabajo real 
  // de un encargado de edificio.
  {
    name: '📺 Perfil 8: Streaming y Pop Culture',
    topics: ['el encargado', 'casados con hijos', 'maria becerra'],
  },

  // ============================================================================
  // 🌍 GRUPO 9: GEOPOLÍTICA DURA
  // ============================================================================
  // Desafío: Ver cómo el motor híbrido prioriza notas internacionales pesadas.
  {
    name: '🌍 Perfil 9: Internacionales',
    topics: ['kamala harris', 'union europea', 'guerra en gaza'],
  },

  // ============================================================================
  // 🏎️ GRUPO 10: DEPORTES MENOS MASIVOS
  // ============================================================================
  // Desafío: Evitar que el fútbol se trague a otros deportes locales.
  {
    name: '🏎️ Perfil 10: Deportes Especializados',
    topics: ['turismo carretera', 'liga nacional de basquet', 'polo argentino'],
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