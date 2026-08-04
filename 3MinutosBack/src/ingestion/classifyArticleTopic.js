const { openai } = require('../config/openai');

// 1. DICCIONARIO ESTRUCTURAL: Define exactamente qué tópico pertenece a qué categoría
const CATEGORY_TOPIC_MAP = {
  'Política': ['Gobierno Nacional', 'Justicia', 'Elecciones', 'Educación', 'Seguridad'],
  'Economía': ['Dólar y Mercados', 'Inflación y Consumo', 'Empresas y Negocios', 'Inversiones', 'Emprendedores'],
  'Internacional': ['EEUU', 'Medio Oriente', 'Europa', 'América Latina', 'Conflictos', 'Geopolítica'],
  'Deportes': ['Fútbol', 'F1', 'Básquet', 'Tenis', 'Rugby'],
  'Sociedad': ['Salud', 'Bienestar', 'Clima y Ambiente', 'Historias Humanas', 'Tendencias Y Vida'],
  'Tecnología': ['Inteligencia Artificial', 'Ciencia y Espacio', 'Apps y Redes', 'Innovación', 'Videojuegos'],
  'Entretenimiento/Cultura': ['Cine y Series', 'Música', 'Turismo y Viajes', 'Streaming', 'Autos', 'Viral y Trending', 'Teatro y Literatura']
};

const ALL_CATEGORIES = Object.keys(CATEGORY_TOPIC_MAP);
const ALL_OFFICIAL_TOPICS = Object.values(CATEGORY_TOPIC_MAP).flat();

function buildPromptReglasYCategorias() {
  // Construimos el mapa en texto para que la IA lo entienda
  const jerarquiaPrompt = Object.entries(CATEGORY_TOPIC_MAP)
    .map(([cat, tops]) => `- ${cat}: ${tops.join(', ')}`)
    .join('\n  ');

  return `Sos un clasificador de noticias argentinas. Tu única tarea es asignar la categoría general y el subtema oficial de una noticia.

  JERARQUÍA ESTRICTA PERMITIDA (Elegí solo combinaciones válidas):
  ${jerarquiaPrompt}

  REGLAS ESTRICTAS:
  - Respondé ÚNICAMENTE con JSON válido. Sin texto antes ni después.
  - Formato: {"category": "...", "topic": "..."}
  - "category" DEBE ser una de las categorías principales.
  - "topic" DEBE pertenecer ESTRICTAMENTE a la lista de la categoría que elegiste. 
  - Si la noticia no encaja claramente en ningún tópico de su categoría, poné "General".
  - NUNCA inventes un tópico ni cruces un tópico de una categoría con otra.`;
}

function buildPrompt(article) {
  const title   = String(article.title || '').trim();
  const summary = String(article.rawSummary || article.contentSnippet || '').trim();
  const source  = String(article.sourceName || '').trim();
  return `Titular: ${title}\n${summary ? `Resumen: ${summary}` : ''}\n${source ? `Fuente: ${source}` : ''}`;
}

async function classifyArticleTopic(article = {}) {
  const title = String(article.title || '').trim();
  if (!title) throw new Error('Missing article title for classification');

  const prompt = buildPrompt(article);
  const promptDeReglasYCategorias = buildPromptReglasYCategorias();

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: promptDeReglasYCategorias },
      { role: 'user', content: prompt }
    ],
    temperature: 0,
    max_tokens: 80,
  });

  const raw   = String(response.choices?.[0]?.message?.content || '').trim();
  const clean = raw.replace(/```json|```/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new Error(`Classifier returned invalid JSON: ${raw}`);
  }

  // 1. Validación de Categoría: Si la IA inventa una, forzamos a "Sociedad"
  const category = ALL_CATEGORIES.includes(parsed.category) ? parsed.category : 'Sociedad';

  // 2. Validación de Tópico (Filtro JS): Extraemos lo que devolvió la IA
  let topic = String(parsed.topic || 'General').trim();

  // 3. EL FILTRO INTELIGENTE JAVASCRIPT:
  // Verificamos si el tópico que eligió la IA realmente le pertenece a la categoría final
  const validTopicsForCategory = CATEGORY_TOPIC_MAP[category] || [];
  
  if (!validTopicsForCategory.includes(topic) && topic !== 'General') {
    console.warn(`⚠️ [Filtro JS] La IA intentó asignar el tópico "${topic}" a la categoría "${category}". Forzando a "General".`);
    topic = 'General';
  }

  return { category, topic };
}

module.exports = {
  classifyArticleTopic,
  ALL_CATEGORIES,
  ALL_OFFICIAL_TOPICS,
};