const { openai } = require('../config/openai');

const CATEGORIES = {
  'Política':       ['Gobierno Nacional', 'Justicia', 'Elecciones', 'Educación', 'Seguridad'],
  'Economía':       ['Dólar y Mercados', 'Inflación y Consumo', 'Empresas y Negocios', 'Inversiones', 'Emprendedores'],
  'Internacional':  ['EEUU', 'Medio Oriente', 'Europa', 'América Latina', 'Conflictos', 'Geopolítica'],
  'Deportes':       ['Fútbol', 'F1', 'Básquet', 'Tenis', 'Rugby'],
  'Sociedad':       ['Salud', 'Bienestar', 'Clima y Ambiente', 'Historias Humanas', 'Tendencias Y Vida'],
  'Tecnología':     ['Inteligencia Artificial', 'Ciencia y Espacio', 'Apps y Redes', 'Innovación', 'Videojuegos'],
  'Entretenimiento/Cultura': ['Cine y Series', 'Música', 'Turismo y Viajes', 'Streaming', 'Autos', 'Viral y Trending','Teatro y Literatura'],
};

const ALL_CATEGORIES = Object.keys(CATEGORIES);
const ALL_TOPICS     = Object.values(CATEGORIES).flat();

function buildCategoryListText() {
  return Object.entries(CATEGORIES)
    .map(([cat, topics]) => {
      const lines = topics.map((t, i) => `     ${i + 1}. "${t}"`).join('\n');
      return `  Categoría: "${cat}"\n  Subtemas:\n${lines}`;
    })
    .join('\n\n');
}

function buildPromptReglasYCategorias() {
  return `Sos un clasificador de noticias. Tu tarea es asignar una categoría, un subtema y el país principal de la noticia.
LISTA DE CATEGORÍAS Y SUBTEMAS OFICIALES:
${buildCategoryListText()}

REGLAS ESTRICTAS:
1. Respondé ÚNICAMENTE con JSON válido. Formato: {"category": "...", "topic": "...", "geoScope": "..."}
2. "category": DEBE ser una de las Categorías de la lista (Política, Economía, etc).
3. "topic": PRIORIZÁ usar uno de los Subtemas Oficiales de la lista. REGLA DE ESCAPE: Si la noticia NO encaja a la perfección en la lista oficial (ej: Béisbol, Natación, farándula extranjera, un accidente de tránsito local), ESTÁ PROHIBIDO forzarla. En ese caso, creá una etiqueta libre y precisa de 1 a 3 palabras (ej: "Béisbol", "Accidente", "Policiales").
4. "geoScope": El país principal donde ocurren los hechos de la noticia (ej: "Argentina", "México", "España", "Estados Unidos"). Usá "Global" ÚNICAMENTE si la noticia afecta a todo el mundo por igual (ej: pandemia mundial, calentamiento global, caída de WhatsApp).`;
}

function buildPrompt(article) {
  const title   = String(article.title || '').trim();
  const summary = String(article.rawSummary || article.contentSnippet || '').trim();
  const source  = String(article.sourceName || '').trim();

  return `ARTÍCULO A CLASIFICAR:
Titular: ${title}
${summary ? `Resumen: ${summary}\n` : ''}${source ? `Fuente: ${source}` : ''}`;
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

  // Validamos la categoría. Si alucina la categoría padre, va a Sociedad
  const category = ALL_CATEGORIES.includes(parsed.category) ? parsed.category : 'Sociedad';
  const topic = String(parsed.topic || 'General').trim();
  const geoScope = String(parsed.geoScope || 'Global').trim();

  return { category, topic, geoScope };
}

module.exports = {
  classifyArticleTopic,
  CATEGORIES,
  ALL_CATEGORIES,
  ALL_TOPICS,
};