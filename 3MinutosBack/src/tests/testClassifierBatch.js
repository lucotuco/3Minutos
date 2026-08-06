require('dotenv').config();
const { classifyArticleTopic } = require('../ingestion/classifyArticleTopic');

const testArticles = [
  // --- TRAMPAS DE DEPORTES VS AUTOS / MUNDIAL ---
  { title: "Franco Colapinto debuta en la Fórmula 1 con un sorprendente quinto puesto", rawSummary: "El piloto argentino logró una hazaña histórica en Monza." },
  { title: "Perú le ganó a México en el Mundial Sub 17 de Vóley Femenino", rawSummary: "El equipo peruano demostró superioridad en el torneo juvenil internacional." },
  { title: "El TC se sumó al fútbol argentino: 'Las Malvinas son argentinas'", rawSummary: "Los pilotos de Turismo Carretera mostraron un cartel antes de la carrera." },
  { title: "Scaloni define los titulares para el debut de Argentina en el Mundial 2026", rawSummary: "La Selección buscará defender el título en Estados Unidos." },
  { title: "Alcaraz desplazó a Zverev: así quedó el ranking ATP tras Roland Garros", rawSummary: "El español sigue subiendo en la clasificación mundial de tenis." },
  
  // --- TRAMPAS DE SEGURIDAD / SOCIEDAD VS POLÍTICA ---
  { title: "Un joven fue asesinado a la salida de un boliche en Palermo", rawSummary: "La policía busca a los agresores que huyeron en un auto negro." },
  { title: "Patricia Bullrich anunció un nuevo protocolo antipiquetes", rawSummary: "La ministra de Seguridad detalló las medidas que tomarán las fuerzas federales." },
  { title: "Femicidio en Mar del Plata: joven madre fue asesinada", rawSummary: "El principal sospechoso es su ex pareja, quien ya tenía denuncias previas." },
  { title: "Operación Xadrez mira traficantes del TCP en Cariacica, no Espírito Santo", rawSummary: "Polícia Civil prendeu cinco suspeitos com armas e drogas." },
  
  // --- TRAMPAS DE JUSTICIA ---
  { title: "Fijan nueva fecha para las pericias al cura investigado por abuso infantil", rawSummary: "La fiscalía reprogramó las fechas tras el paro judicial." },
  { title: "La Corte Suprema rechazó el per saltum pedido por el Gobierno", rawSummary: "Los jueces decidieron no intervenir en el conflicto por los fondos coparticipables." },
  { title: "Detienen al empresario acusado de estafa piramidal con criptomonedas", rawSummary: "Fue interceptado en el aeropuerto de Ezeiza intentando salir del país." },
  
  // --- ECONOMÍA / EMPRESAS / INFLACIÓN ---
  { title: "El dólar blue pegó un salto y cerró a $1.350", rawSummary: "Tensión en los mercados tras los nuevos anuncios del Banco Central." },
  { title: "Mercado Libre reportó ganancias récord en el tercer trimestre", rawSummary: "La empresa de Marcos Galperin superó las expectativas de Wall Street." },
  { title: "La inflación de julio fue del 4% según el INDEC", rawSummary: "Acumula un alza del 87% en lo que va del año." },
  { title: "Monotributo: termina mañana el plazo para la recategorización", rawSummary: "La AFIP recordó que los montos a pagar tuvieron un reajuste." },

  // --- POLÍTICA / GOBIERNO ---
  { title: "Milei acelera en el Congreso: quiere aprobar 4 reformas clave", rawSummary: "El Presidente negocia con los bloques dialoguistas para tener dictamen." },
  { title: "Dura réplica de Diego Santilli a Ricardo Quintela tras su amenaza", rawSummary: "El jefe de Gabinete cruzó con dureza al gobernador riojano." },
  { title: "Escándalo en el Senado: la oposición denunció el cajoneo de proyectos", rawSummary: "Legisladores amenazan con judicializar el conflicto en Córdoba." },
  
  // --- INTERNACIONAL / GEOPOLÍTICA ---
  { title: "EE.UU. asegura que está cerca de acuerdo con Irán", rawSummary: "El secretario del Tesoro anticipa un arreglo para reabrir el estrecho de Ormuz." },
  { title: "Drone ucraniano cai em praia lotada perto de 'complexo secreto' de Putin", rawSummary: "Explosão deixou quatro mortos na região de Krasnodar, na Rússia." },
  { title: "Elecciones en Venezuela: tensión tras la denuncia de fraude", rawSummary: "La comunidad internacional pide que se muestren las actas." },
  
  // --- TECNOLOGÍA / CIENCIA / VIDEOJUEGOS ---
  { title: "Google presenta Gemini Robotics 2 para robots más avanzados", rawSummary: "El nuevo modelo de inteligencia artificial permite un control inteligente del cuerpo." },
  { title: "Crean un anillo inteligente que monitorea glucosa sin pinchazos", rawSummary: "Avance científico revolucionario para personas con diabetes." },
  { title: "Epic Games regala un nuevo juego de ciencia ficción para PC", rawSummary: "Los jugadores podrán descargarlo gratis por tiempo limitado." },
  { title: "Apple demandó a OpenAI por robo de secretos comerciales", rawSummary: "Un ingeniero de la manzana habría filtrado código fuente a la empresa de ChatGPT." },

  // --- ENTRETENIMIENTO / CULTURA / HISTORIAS HUMANAS ---
  { title: "Qué ver en Netflix este fin de semana: 4 series para maratonear", rawSummary: "Recomendaciones de los estrenos más esperados de la plataforma de streaming." },
  { title: "Taylor Swift arrasó en los premios Grammy y rompió un nuevo récord", rawSummary: "La cantante pop se llevó el galardón a Mejor Álbum del Año por cuarta vez." },
  { title: "El tour gastronómico de Rosalía en Buenos Aires", rawSummary: "La artista paseó por la ciudad, firmó autógrafos y probó asado argentino." },
  { title: "La casa que construyó un niño de 13 años por apenas 1.500 dólares", rawSummary: "Tiene 27 metros cuadrados e incluye cocina, living y cama." },
  { title: "Descubren civilización oculta bajo la Amazonia con tecnología láser", rawSummary: "Arqueólogos hallaron ciudades milenarias que cambiarán la historia de la región." },

  // --- SALUD / CLIMA / BIENESTAR ---
  { title: "Radiografía del cerebro argentino: alerta por la salud mental", rawSummary: "Un estudio revela alto nivel de confianza pero con malos hábitos de sueño y estrés." },
  { title: "Se viene un “Súper Niño” que traerá 72 horas de tormentas fuertes", rawSummary: "El Servicio Meteorológico emitió alertas amarillas y naranjas para varias provincias." },
  { title: "Los nutricionistas coinciden: no hay nada más fácil de digerir que el arroz", rawSummary: "Mitos y verdades sobre el consumo de carbohidratos en la dieta diaria." },

  // --- NOTICIAS GENERALES (DIFÍCILES DE CLASIFICAR) ---
  { title: "Tránsito colapsado en la Panamericana por el vuelco de un camión", rawSummary: "Hay demoras de hasta dos horas en sentido a Capital Federal." },
  { title: "Cómo saber si una memoria USB está dañada", rawSummary: "Señales a tener en cuenta antes de perder todos tus archivos." },
  { title: "El Papa Francisco pide paz durante su discurso dominical en el Vaticano", rawSummary: "Ante miles de fieles en la Plaza de San Pedro, el sumo pontífice dio su mensaje." },
  { title: "Una modelo semidesnuda corriendo por Belgrano en medio de la noche", rawSummary: "Vecinos llamaron al 911 tras ver el extraño episodio en la calle." }
];

async function runBatchTest() {
  console.log('⚡ INICIANDO BATERÍA MASIVA DE CLASIFICACIÓN (40 Artículos)\n');
  console.log('FORMATO: [Categoría Final] -> [Tópico Final] | Título');
  console.log('-'.repeat(80));

  let successCount = 0;

  for (let i = 0; i < testArticles.length; i++) {
    const article = testArticles[i];
    
    try {
      const { category, topic } = await classifyArticleTopic(article);
      
      // Formateo visual para la consola
      const catPad = category.padEnd(25, ' ');
      const topPad = topic.padEnd(25, ' ');
      const shortTitle = article.title.length > 55 ? article.title.substring(0, 55) + '...' : article.title;

      console.log(`✅ [${catPad}] -> [${topPad}] | ${shortTitle}`);
      successCount++;

    } catch (error) {
      console.log(`❌ ERROR EN ARTÍCULO ${i + 1}: ${article.title}`);
      console.log(`   Motivo: ${error.message}`);
    }
  }

  console.log('-'.repeat(80));
  console.log(`📊 RESULTADOS: Procesados ${successCount} de ${testArticles.length} con éxito.`);
  console.log('⚠️ Revisa la consola más arriba para ver si se activó el [Filtro JS].');
}

runBatchTest();