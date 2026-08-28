const { openai } = require('../config/openai');

const CATEGORIES = {
  'Política':       ['Gobierno Nacional', 'Justicia', 'Elecciones', 'Educación', 'Seguridad'],
  'Economía':       ['Dólar y Mercados', 'Inflación y Consumo', 'Empresas y Negocios', 'Inversiones', 'Emprendedores'],
  'Internacional':  ['EEUU', 'Medio Oriente', 'Europa', 'América Latina', 'Conflictos', 'Geopolítica'],
  'Deportes':       ['Fútbol', 'F1', 'Básquet', 'Tenis', 'Rugby'],
  'Sociedad':       ['Salud', 'Bienestar', 'Clima y Ambiente', 'Historias Humanas', 'Tendencias y Vida'],
  'Tecnología':     ['Inteligencia Artificial', 'Ciencia y Espacio', 'Apps y Redes', 'Innovación', 'Videojuegos'],
  'Entretenimiento/Cultura': ['Cine y Series', 'Música', 'Turismo y Viajes', 'Streaming', 'Autos', 'Viral y Trending', 'Teatro y Literatura'],
};

const ALL_CATEGORIES = Object.keys(CATEGORIES);
const ALL_TOPICS      = Object.values(CATEGORIES).flat();

const TOPIC_TO_CATEGORY = Object.fromEntries(
  Object.entries(CATEGORIES).flatMap(([cat, topics]) => topics.map((t) => [t, cat]))
);

function buildCategoryListText() {
  return Object.entries(CATEGORIES)
    .map(([cat, topics]) => {
      const lines = topics.map((t, i) => `     ${i + 1}. "${t}"`).join('\n');
      return `  Categoría: "${cat}"\n  Subtemas permitidos SOLO para esta categoría:\n${lines}`;
    })
    .join('\n\n');
}

function buildPromptReglasYCategorias() {
  return `Sos un clasificador de noticias. Tu tarea es asignar una categoría, un subtema y el país principal de la noticia.

LISTA DE CATEGORÍAS Y SUBTEMAS OFICIALES:
${buildCategoryListText()}

REGLAS ESTRICTAS:
1. Respondé ÚNICAMENTE con JSON válido. Formato: {"category": "...", "topic": "...", "geoScope": "..."}
2. "category": DEBE ser una de las Categorías de la lista.
3. "topic": DEBE pertenecer a la lista de Subtemas de LA MISMA "category" que elegiste. PROHIBIDO devolver un subtema que pertenezca a otra categoría.
4. ANTES de crear una etiqueta libre, revisá si el concepto ya está cubierto por un Subtema Oficial.
5. REGLA DE ESCAPE: Solo si la noticia NO encaja en NINGÚN subtema oficial de su categoría, creá una etiqueta libre y precisa de 1 a 3 palabras.
6. "geoScope": El país principal donde ocurren los hechos (ej: "Argentina", "México", "España", "Estados Unidos"). Usá "Global" ÚNICAMENTE si afecta a todo el mundo por igual.
7. 🌍 REGLA GEOGRÁFICA ESTRICTA: Las categorías "Política" (Gobierno Nacional, Justicia, Elecciones) y "Economía" son EXCLUSIVAS para Argentina. Si la noticia ocurre en OTRO PAÍS (ej: España, Perú, Brasil), ESTÁ PROHIBIDO usar Política o Economía. DEBE ir OBLIGATORIAMENTE a "Internacional" (usando subtemas como "América Latina", "Europa", "EEUU" o "Geopolítica").`;
}

function buildPrompt(article) {
  const title   = String(article.title || '').trim();
  const summary = String(article.rawSummary || article.contentSnippet || '').trim();
  const source  = String(article.sourceName || '').trim();

  return `ARTÍCULO A CLASIFICAR:\nTitular: ${title}\n${summary ? `Resumen: ${summary}\n` : ''}${source ? `Fuente: ${source}` : ''}`;
}

// Normaliza etiquetas libres del Valve: Title Case, con conjunciones en minúscula.
const LOWERCASE_WORDS = new Set(['y', 'de', 'del', 'la', 'el', 'los', 'las', 'en', 'a']);
function normalizeFreeTopic(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i > 0 && LOWERCASE_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

async function classifyArticleTopic(article = {}) {
  const title = String(article.title || '').trim();
  if (!title) throw new Error('Missing article title for classification');

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: buildPromptReglasYCategorias() },
      { role: 'user', content: buildPrompt(article) }
    ],
    temperature: 0,
    max_tokens: 100,
  });

  const raw   = String(response.choices?.[0]?.message?.content || '').trim();
  const clean = raw.replace(/```json|```/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new Error(`Classifier returned invalid JSON: ${raw}`);
  }

  let category = ALL_CATEGORIES.includes(parsed.category) ? parsed.category : 'Sociedad';
  let topic    = String(parsed.topic || 'General').trim();
  const geoScope = String(parsed.geoScope || 'Global').trim();

  if (TOPIC_TO_CATEGORY[topic]) {
    category = TOPIC_TO_CATEGORY[topic];
  } else {
    topic = normalizeFreeTopic(topic);
  }
  const isForeign = geoScope !== 'Argentina' && geoScope !== 'Global';
  const domesticCategories = ['Política', 'Economía'];
  
  if (isForeign && domesticCategories.includes(category)) {
    console.log(`🌍 [Fuga Geográfica Bloqueada] Re-enrutando noticia de ${geoScope} ("${topic}") a Internacional.`);
    category = 'Internacional';
    
    const latamCountries = ['Brasil', 'Chile', 'Uruguay', 'Perú', 'Colombia', 'México', 'Venezuela', 'Bolivia', 'Paraguay', 'Ecuador'];
    const europeCountries = ['España', 'Francia', 'Italia', 'Reino Unido', 'Alemania', 'Rusia', 'Ucrania'];
    
    if (latamCountries.includes(geoScope)) topic = 'América Latina';
    else if (europeCountries.includes(geoScope)) topic = 'Europa';
    else if (geoScope === 'Estados Unidos') topic = 'EEUU';
    else topic = 'Geopolítica';
  }

  return { category, topic, geoScope };
}

module.exports = {
  classifyArticleTopic,
  CATEGORIES,
  ALL_CATEGORIES,
  ALL_TOPICS,
  TOPIC_TO_CATEGORY,
};