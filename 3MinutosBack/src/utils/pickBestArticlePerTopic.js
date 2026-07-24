const Article = require('../models/Article');
const { enrichArticleRanking } = require('./articleRanking');
const { ALL_CATEGORIES } = require('../ingestion/classifyArticleTopic');
const { searchArticlesBySimilarityAtlas } = require('../embeddings/searchArticlesBySimilarityAtlas');
const { openai } = require('../config/openai');

// 🕒 REGLA GLOBAL DE FRESCURA PARA TODA LA APP (48 HORAS)
const MAX_ARTICLE_AGE_HOURS = 48;

function getFreshnessCutoff() {
  return new Date(Date.now() - MAX_ARTICLE_AGE_HOURS * 60 * 60 * 1000);
}

const OPINION_KEYWORDS = ['opinion', 'opinión', 'columna', 'columnista', 'editorial', 'analisis', 'análisis'];

const TOPIC_TO_CATEGORY = {
  'Gobierno Nacional': 'Política',
  'Justicia': 'Política',
  'Elecciones': 'Política',
  'Educación': 'Política',
  'Seguridad': 'Política',
  'Dólar y Mercados': 'Economía',
  'Inflación y Consumo': 'Economía',
  'Empresas y Negocios': 'Economía',
  'Inversiones': 'Economía',
  'Emprendedores': 'Economía',
  'EEUU': 'Internacional',
  'Medio Oriente': 'Internacional',
  'Europa': 'Internacional',
  'América Latina': 'Internacional',
  'Conflictos': 'Internacional',
  'Geopolítica': 'Internacional',
  'Fútbol': 'Deportes',
  'Mundial 2026': 'Deportes',
  'Básquet': 'Deportes',
  'Tenis': 'Deportes',
  'Rugby': 'Deportes',
  'Salud': 'Sociedad',
  'Bienestar': 'Sociedad',
  'Clima y Ambiente': 'Sociedad',
  'Historias Humanas': 'Sociedad',
  'Tendencias Y Vida': 'Sociedad',
  'Inteligencia Artificial': 'Tecnología',
  'Ciencia y Espacio': 'Tecnología',
  'Apps y Redes': 'Tecnología',
  'Innovación': 'Tecnología',
  'Videojuegos': 'Tecnología',
  'Cine y Series': 'Entretenimiento/Cultura',
  'Música': 'Entretenimiento/Cultura',
  'Turismo y Viajes': 'Entretenimiento/Cultura',
  'Streaming': 'Entretenimiento/Cultura',
  'Autos': 'Entretenimiento/Cultura',
  'Viral y Trending': 'Entretenimiento/Cultura',
  'Teatro y Literatura': 'Entretenimiento/Cultura',
};

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

async function expandTopicForEmbedding(rawTopic) {
  const topic = String(rawTopic || '').trim();
  
  // Si el tema ya tiene 3 palabras o más (ej: "crisis económica inflación"), lo usamos directo
  if (topic.split(/\s+/).length >= 3) {
    return topic;
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Sos un asistente de búsqueda para una app de noticias en Argentina. El usuario te da 1 o 2 palabras. Tu única tarea es devolver un string de 5 a 7 palabras clave altamente descriptivas para buscar noticias de actualidad nacional en una base vectorizada. Si la palabra es un club deportivo local ("boca", "river", "racing", "rojo", "lobo", "pincha", "cuervo") o argot argentino, asumí SIEMPRE su significado local. Devolvé ÚNICAMENTE las palabras clave sin puntuación ni explicaciones.'
        },
        { role: 'user', content: topic }
      ],
      temperature: 0,
      max_tokens: 25,
    });

    const expanded = response.choices?.[0]?.message?.content?.trim() || topic;
    console.log(`🧠 [Query Expansion IA] "${topic}" -> expandido a "${expanded}"`);
    return expanded;
  } catch (error) {
    console.warn(`⚠️ Falló expansión IA para "${topic}", usando original:`, error.message);
    return `${topic} noticias actualidad Argentina`; // Fallback de seguridad
  }
}

function includesOpinionKeyword(value) {
  const normalized = normalizeText(value);
  return OPINION_KEYWORDS.some((kw) => normalized.includes(normalizeText(kw)));
}

function calculateTitleSimilarity(title1, title2) {
  if (!title1 || !title2) return 0;
  
  const cleanText = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/g, " ");
  
  const words1 = new Set(cleanText(title1).split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(cleanText(title2).split(/\s+/).filter(w => w.length > 3));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  let intersection = 0;
  for (const w of words1) {
    if (words2.has(w)) intersection++;
  }
  
  const shortestLength = Math.min(words1.size, words2.size);
  return intersection / shortestLength;
}

function isUsableDigestArticle(article, usedUrls, usedTitles = []) {
  if (!article?.url) return false;
  if (usedUrls.has(article.url)) return false;
  if (isOpinionArticle(article)) return false;

  // 🛡️ BARRERA DE SEGURIDAD EN MEMORIA: Doble chequeo anti-noticias viejas
  if (article.publishedAt) {
    const pubDate = new Date(article.publishedAt).getTime();
    const diffHours = (Date.now() - pubDate) / (1000 * 60 * 60);
    if (diffHours > MAX_ARTICLE_AGE_HOURS) {
      console.log(`      ⛔ [CADUCIDAD ${Math.round(diffHours)} HS] BLOQUEADO POR EDAD: "${article.neutralTitle || article.title}"\n`);
      return false;
    }
  }

  const candidateTitle = article.neutralTitle || article.title || "";
  
  let maxSim = 0;
  let mostSimilarTitle = "";

  for (const seenTitle of usedTitles) {
    const similarity = calculateTitleSimilarity(candidateTitle, seenTitle);
    if (similarity > maxSim) {
      maxSim = similarity;
      mostSimilarTitle = seenTitle;
    }
  }

  if (maxSim >= 0.40) {
    console.log(`      ⛔ [SIMILITUD ${Math.round(maxSim*100)}%] BLOQUEADO:`);
    console.log(`         ❌ Intentó entrar: "${candidateTitle}"`);
    console.log(`         📄 Ya habías leído: "${mostSimilarTitle}"\n`);
    return false;
  } else if (maxSim > 0.15) {
    console.log(`      ✅ [SIMILITUD ${Math.round(maxSim*100)}%] PERMITIDO:`);
    console.log(`         🆕 Entró: "${candidateTitle}"`);
    console.log(`         🔍 Se evaluó contra: "${mostSimilarTitle}"\n`);
  }

  return true;
}

function isOpinionArticle(article = {}) {
  const url      = normalizeText(article.url);
  const title    = normalizeText(article.title);
  const section  = normalizeText(article.section);
  const category = normalizeText(article.category);
  const tags     = Array.isArray(article.tags) ? article.tags.map(normalizeText) : [];

  if (url.includes('/opiniones/') || url.includes('/opinion/')) return true;
  if (includesOpinionKeyword(section) || includesOpinionKeyword(category)) return true;
  if (tags.some((tag) => includesOpinionKeyword(tag))) return true;
  if (includesOpinionKeyword(title)) return true;

  return false;
}

async function findCandidatesForTopic(topic, limit, useCutoff = true) {
  const isMainCategory = ALL_CATEGORIES.includes(topic);

  const baseQuery = {
    ...(isMainCategory ? { category: topic } : { topic: new RegExp('^' + topic + '$', 'i') }),
  };

  // 🛡️ FILTRO MONGO 1 y 2: Aplicamos siempre el corte estricto de 48 horas en la base de datos
  if (useCutoff) {
    baseQuery.publishedAt = { $gte: getFreshnessCutoff() };
  }

  const selectFields = [
    '_id', 'title', 'url', 'sourceName',
    'section', 'region', 'tags',
    'category', 'topic',
    'importanceScore', 'publishedAt',
    'neutralTitle', 'neutralLead', 'neutralSummary',
    'neutralityScore', 'politicalBiasRisk', 'curationStatus',
    'rawSummary', 'contentSnippet', 'imageUrl',
  ].join(' ');

  let articles = await Article.find({ ...baseQuery, topicStatus: 'done' })
    .sort({ importanceScore: -1, publishedAt: -1 })
    .limit(limit * 10)
    .select(selectFields)
    .lean();

  if (articles.length < limit) {
    const missingCount = limit - articles.length;
    const fallbackArticles = await Article.find({
      ...baseQuery,
      topicStatus: { $in: ['pending', 'error'] },
    })
      .sort({ importanceScore: -1, publishedAt: -1 })
      .limit(missingCount * 4)
      .select(selectFields)
      .lean();

    articles = articles.concat(fallbackArticles);
  }

  return articles
    .map(enrichArticleRanking)
    .sort((a, b) => b.rankingScore - a.rankingScore);
}

async function pickBestArticlePerTopic(topics = [], options = {}) {
  if (!Array.isArray(topics) || topics.length === 0) return [];

  const { perTopicLimit = 10, alreadyShownUrls = [], alreadyShownTitles = [] } = options;

  const usedUrls = new Set(alreadyShownUrls);
  const usedTitles = [...alreadyShownTitles];
  const results  = [];

  const rawOfficialTopics = [
    ...ALL_CATEGORIES,
    ...Object.keys(TOPIC_TO_CATEGORY),
    ...Object.values(TOPIC_TO_CATEGORY)
  ];

  const officialTopicsMap = new Map();
  for (const t of rawOfficialTopics) {
    officialTopicsMap.set(normalizeText(t), t);
  }

  for (const rawTopic of topics) {
    const trimmedTopic = String(rawTopic || '').trim();
    if (!trimmedTopic) continue;

    const normTopic = normalizeText(trimmedTopic);
    
    let topic = trimmedTopic;
    let isOfficial = false;

    if (officialTopicsMap.has(normTopic)) {
      topic = officialTopicsMap.get(normTopic); 
      isOfficial = true;
    }
    
    let bestUnused = null;
    let usedFallback = false;
    let fallbackCategory = null;

    if (isOfficial) {
      // -------------------------------------------------------------
      // CONSULTA 1: TEMA OFICIAL (Con filtro Mongo 48hs)
      // -------------------------------------------------------------
      let candidates = await findCandidatesForTopic(topic, perTopicLimit, true);
      bestUnused = candidates.find((article) => isUsableDigestArticle(article, usedUrls, usedTitles));

      // -------------------------------------------------------------
      // CONSULTA 2: FALLBACK A CATEGORÍA (Con filtro Mongo 48hs)
      // -------------------------------------------------------------
      if (!bestUnused) {
        const category = TOPIC_TO_CATEGORY[topic];
        if (category && category !== topic) {
          candidates = await findCandidatesForTopic(category, perTopicLimit, true);
          bestUnused = candidates.find((article) => isUsableDigestArticle(article, usedUrls, usedTitles));
          
          if (bestUnused) {
            usedFallback = true;
            fallbackCategory = category;
          }
        }
      }
    } else {
      // -------------------------------------------------------------
      // CONSULTA 3: TEMA LIBRE O VECTORES (Con filtro Mongo 48hs inyectado)
      // -------------------------------------------------------------
      try {
        // 💥 PASO 1: Expandimos "boca" a "Boca Juniors fútbol argentino Riquelme" usando IA
        const queryForEmbedding = await expandTopicForEmbedding(trimmedTopic);

        // 💥 PASO 2: Buscamos con ese vector perfecto y el filtro de 48 hs en Mongo
        const semanticCandidates = await searchArticlesBySimilarityAtlas(queryForEmbedding, { 
          limit: perTopicLimit * 2,
          minDate: getFreshnessCutoff() 
        });

        const usableSemantic = semanticCandidates.filter(a => isUsableDigestArticle(a, usedUrls, usedTitles));

        if (usableSemantic.length > 0) {
          const bestMatch = usableSemantic[0];
          console.log(`🔍 [Tema Libre] "${trimmedTopic}" -> Match: "${bestMatch.title}" | Score: ${bestMatch.score?.toFixed(3)}`);
          
          if (bestMatch.score >= 0.60) {
            bestUnused = bestMatch;
            usedFallback = false;
          } else {
            fallbackCategory = bestMatch.category || 'General';
            let candidates = await findCandidatesForTopic(fallbackCategory, perTopicLimit, true);
            bestUnused = candidates.find((article) => isUsableDigestArticle(article, usedUrls, usedTitles));
            usedFallback = true;
            console.warn(`⚠️  Score semántico bajo para "${trimmedTopic}". Fallback a "${fallbackCategory}".`);
          }
        } else {
          fallbackCategory = 'General';
          let candidates = await findCandidatesForTopic(fallbackCategory, perTopicLimit, true);
          bestUnused = candidates.find((article) => isUsableDigestArticle(article, usedUrls, usedTitles));
          usedFallback = true;
          console.warn(`⚠️  Cero resultados vectoriales para "${trimmedTopic}". Fallback a "General".`);
        }
      } catch (error) {
        console.error(`❌ Error en búsqueda semántica para "${trimmedTopic}":`, error);
        usedFallback = true;
      }
    }

    // -------------------------------------------------------------
    // CONSULTA 4: RESCATE DE EMERGENCIA EN MONGODB (Para que no devuelva null)
    // -------------------------------------------------------------
    if (!bestUnused) {
      console.log(`🚨 [RESCATE] No hubo resultados para "${topic}". Buscando noticias frescas generales...`);
      try {
        const emergencyCandidates = await Article.find({
          publishedAt: { $gte: getFreshnessCutoff() },
          topicStatus: 'done'
        })
          .sort({ importanceScore: -1, publishedAt: -1 })
          .limit(perTopicLimit * 3)
          .select('_id title url sourceName section region tags category topic importanceScore publishedAt neutralTitle neutralLead neutralSummary neutralityScore politicalBiasRisk curationStatus rawSummary contentSnippet imageUrl')
          .lean();

        bestUnused = emergencyCandidates.find((article) => isUsableDigestArticle(article, usedUrls, usedTitles));
        if (bestUnused) {
          usedFallback = true;
          fallbackCategory = bestUnused.category || 'General';
        }
      } catch (emergencyErr) {
        console.error(`❌ Error en rescate de emergencia para "${topic}":`, emergencyErr);
      }
    }

    if (!bestUnused) {
      results.push({ 
        topic, 
        article: null,
        usedFallback: false,
        fallbackCategory: null,
      });
      continue;
    }

    usedUrls.add(bestUnused.url);
    usedTitles.push(bestUnused.neutralTitle || bestUnused.title || "");
    
    results.push({ 
      topic, 
      article: bestUnused,
      usedFallback,
      fallbackCategory,
    });
  }

  return results;
}

module.exports = { pickBestArticlePerTopic };