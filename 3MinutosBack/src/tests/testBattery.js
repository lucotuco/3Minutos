require('dotenv').config();
const mongoose = require('mongoose');
const { buildUserNewsDigest } = require('../utils/buildUserNewsDigest');

async function connectDB() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
}

// 🪤 PERFILES TRAMPA: Diseñados para forzar al sistema a cometer errores de duplicación
const TEST_PROFILES = [
  {
    name: 'Perfil 22: Oficiales Core (Economía y Política)',
    topics: ["Gobierno Nacional", "Inflación y Consumo", "Dólar y Mercados"] 
  },
  // 🟢 2. 100% Oficiales - Deportes (Para probar que respeta el corral de categoría)
  {
    name: 'Perfil 23: Oficiales Deportivos',
    topics: ["Fútbol", "Básquet", "Tenis"] 
  },
  // 🟡 3. Mix (2 Oficiales / 1 Libre Popular) - El libre suele tener cobertura, pero no está en la lista oficial
  {
    name: 'Perfil 24: Mix Cultural y Pop',
    topics: ["Cine y Series", "Música", "Taylor Swift"] 
  },
  // 🟡 4. Mix (1 Oficial / 2 Libres Tecnológicos) - Evaluando sub-nichos técnicos
  {
    name: 'Perfil 25: Mix Tech y Nicho',
    topics: ["Innovación", "Criptomonedas", "Baterías Solares"] 
  },
  // 🔴 5. 100% Libres - Nicho Extremo (Debería forzar el fallback y la etiqueta "Sugerido")
  {
    name: 'Perfil 26: Libres de Nicho Extremo (Forzar Fallback)',
    topics: ["Recetas sin TACC", "Ajedrez Ruso", "Vida en Marte"] 
  },
  // 🔴 6. 100% Libres - Trampa Semántica (Palabras oficiales mezcladas con conceptos raros)
  {
    name: 'Perfil 27: Trampas Semánticas Libres',
    topics: ["Cine Mudo", "Fútbol de Mesa", "Autos Voladores"] 
  },
  // 🟢 7. 100% Oficiales - Baja cobertura (Debería encontrar, pero con esfuerzo)
  {
    name: 'Perfil 28: Oficiales de Menor Frecuencia',
    topics: ["Rugby", "Educación", "Ciencia y Espacio"] 
  },
  // 🟡 8. Mix Internacional (2 Oficiales / 1 Libre alarmista) - Para evaluar la neutralidad y el riesgo político
  {
    name: 'Perfil 29: Internacional y Riesgo',
    topics: ["Medio Oriente", "Conflictos", "Tercera Guerra Mundial"] 
  },
  // 🔴 9. 100% Libres - Conceptos abstractos y filosóficos (Para estresar el modelo de Embeddings)
  {
    name: 'Perfil 30: Conceptos Abstractos Libres',
    topics: ["Estoicismo Moderno", "Paz Interior", "Física Cuántica"] 
  },
  // 🟡 10. Superposición Híbrida (Temas casi idénticos pero 1 es oficial y 2 libres)
  {
    name: 'Perfil 31: Superposición Climática',
    topics: ["Clima y Ambiente", "Huracanes en Miami", "Ecología"] 
  }
];

async function runBattery() {
  await connectDB();
  console.log('\n⚡ INICIANDO BATERÍA ANTI-DUPLICADOS Y FALLBACKS...\n' + '='.repeat(60));

  let totalTests = 0;
  let passedTests = 0;

  for (const profile of TEST_PROFILES) {
    console.log(`\n▶️  Ejecutando: ${profile.name}`);
    
    const startTime = Date.now();
    
    // Ejecutamos el motor de curación
    const digest = await buildUserNewsDigest({
      topics: profile.topics,
      alreadyShownUrls: [],
      alreadyShownTitles: [],
      seenEmbeddings: [], // Arrancamos con historial limpio para la prueba
      perTopicLimit: 10,
    });
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    const seenUrls = new Set();
    const seenTitles = new Set();
    let profilePassed = true;

    console.log(`⏱️  Tiempo: ${elapsed}s | Noticias entregadas: ${digest.items.length}/3`);

    digest.items.forEach((item, idx) => {
      totalTests++;
      const num = idx + 1;
      const title = item.title || 'SIN TÍTULO';
      const score = Number(item.rankingScore ?? item.finalScore ?? item.score ?? 0);
      
      console.log(`\n   📰 Noticia ${num} [Tópico pedido: "${profile.topics[idx]}" -> Entregado: "${item.topic}"]`);
      console.log(`      Título: "${title.slice(0, 75)}..."`);
      
      const errors = [];

      // 🚨 1. CHEQUEO ESTRICTO DE DUPLICADOS (URL y Título)
      if (item.url && seenUrls.has(item.url)) {
        errors.push('❌ ERROR: URL DUPLICADA en el mismo resumen.');
      }
      if (seenTitles.has(title)) {
        errors.push('❌ ERROR: TÍTULO DUPLICADO en el mismo resumen.');
      }

      // 🚨 2. CHEQUEO DE DEGRADACIÓN ELEGANTE (Fallback)
      if (profile.name.includes('Fallback') && !item.topic.includes('Sugerido')) {
         errors.push('❌ ERROR: Falló la degradación elegante. No aplicó la etiqueta "Destacado (Sugerido)".');
      }

      if (errors.length > 0) {
        profilePassed = false;
        errors.forEach(e => console.log(`      ${e}`));
      } else {
        passedTests++;
        console.log(`      ✅ ESTADO: Noticia única y validada (Score: ${score.toFixed(1)})`);
      }

      // Añadimos a los Sets para comparar con la SIGUIENTE noticia del mismo ciclo
      if (item.url) seenUrls.add(item.url);
      seenTitles.add(title);
    });

    console.log('-'.repeat(60));
  }

  console.log(`\n📊 RESULTADO FINAL DE LA AUDITORÍA:`);
  console.log(`   Noticias evaluadas: ${totalTests}`);
  console.log(`   Éxitos: ${passedTests} | Fallos: ${totalTests - passedTests}`);
  
  if (passedTests === totalTests) {
    console.log(`\n🏆 ¡TODO PERFECTO! El sistema anti-duplicados funciona al 100%.\n`);
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