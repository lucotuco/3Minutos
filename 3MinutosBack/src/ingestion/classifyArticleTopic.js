const { openai } = require('../config/openai');

const ALL_CATEGORIES = [
  'Política', 'Economía', 'Internacional', 'Deportes',
  'Sociedad', 'Tecnología', 'Entretenimiento/Cultura'
];

// Lista cerrada de tópicos oficiales (debe coincidir con TOPIC_TO_CATEGORY en pickBestArticlePerTopic.js)
const ALL_OFFICIAL_TOPICS = [
  // Política
  'Gobierno Nacional', 'Justicia', 'Elecciones', 'Educación', 'Seguridad',
  // Economía
  'Dólar y Mercados', 'Inflación y Consumo', 'Empresas y Negocios', 'Inversiones', 'Emprendedores',
  // Internacional
  'EEUU', 'Medio Oriente', 'Europa', 'América Latina', 'Conflictos', 'Geopolítica',
  // Deportes
  'Fútbol', 'F1', 'Básquet', 'Tenis', 'Rugby',
  // Sociedad
  'Salud', 'Bienestar', 'Clima y Ambiente', 'Historias Humanas', 'Tendencias Y Vida',
  // Tecnología
  'Inteligencia Artificial', 'Ciencia y Espacio', 'Apps y Redes', 'Innovación', 'Videojuegos',
  // Entretenimiento/Cultura
  'Cine y Series', 'Música', 'Turismo y Viajes', 'Streaming', 'Autos', 'Viral y Trending', 'Teatro y Literatura',
];

function buildPromptReglasYCategorias() {
  return `Sos un clasificador de noticias argentinas. Tu única tarea es asignar la categoría general y el subtema oficial.
  CATEGORÍAS PERMITIDAS (Copia exacta):
  ${ALL_CATEGORIES.join(', ')}

  TÓPICOS OFICIALES PERMITIDOS (Copia exacta):
  ${ALL_OFFICIAL_TOPICS.join(', ')}

  REGLAS ESTRICTAS:
  - Respondé ÚNICAMENTE con JSON válido. Sin texto antes ni después.
  - Formato: {"category": "...", "topic": "..."}
  - "category" DEBE ser una de las categorías permitidas.
  - "topic" DEBE ser uno de los tópicos oficiales de la lista de arriba. Si la noticia no encaja claramente en ninguno, poné "General". NUNCA inventes un tópico que no esté en la lista.
  - El "topic" elegido debe corresponder a la "category" asignada (ej: si la categoría es "Deportes", el topic debe ser uno deportivo como "Fútbol", "Básquet", "Tenis", "Rugby" o "F1").`;
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

  // Validamos que la categoría sea oficial, si alucina cae a Sociedad
  const category = ALL_CATEGORIES.includes(parsed.category) ? parsed.category : 'Sociedad';

  // Validamos que el tópico sea oficial, si alucina o no encaja cae a General
  const rawTopic = String(parsed.topic || 'General').trim();
  const topic = ALL_OFFICIAL_TOPICS.includes(rawTopic) ? rawTopic : 'General';

  return { category, topic };
}

module.exports = {
  classifyArticleTopic,
  ALL_CATEGORIES,
  ALL_OFFICIAL_TOPICS,
};