const Article = require('../models/Article');
const { enrichArticleRanking } = require('./articleRanking');
const { ALL_CATEGORIES } = require('../ingestion/classifyArticleTopic');
const { searchArticlesBySimilarityAtlas } = require('../embeddings/searchArticlesBySimilarityAtlas');
const { openai } = require('../config/openai');
const { cosineSimilarity } = require('../embeddings/searchArticlesBySimilarity');

const MAX_ARTICLE_AGE_HOURS = 48;

function getFreshnessCutoff() {
  return new Date(Date.now() - MAX_ARTICLE_AGE_HOURS * 60 * 60 * 1000);
}

const OPINION_KEYWORDS = ['opinion', 'opinión', 'columna', 'columnista', 'editorial', 'analisis', 'análisis'];

const TOPIC_TO_CATEGORY = {
  'Gobierno Nacional': 'Política', 'Justicia': 'Política', 'Elecciones': 'Política', 'Educación': 'Política', 'Seguridad': 'Política',
  'Dólar y Mercados': 'Economía', 'Inflación y Consumo': 'Economía', 'Empresas y Negocios': 'Economía', 'Inversiones': 'Economía', 'Emprendedores': 'Economía',
  'EEUU': 'Internacional', 'Medio Oriente': 'Internacional', 'Europa': 'Internacional', 'América Latina': 'Internacional', 'Conflictos': 'Internacional', 'Geopolítica': 'Internacional',
  'Fútbol': 'Deportes', 'Mundial 2026': 'Deportes', 'Básquet': 'Deportes', 'Tenis': 'Deportes', 'Rugby': 'Deportes',
  'Salud': 'Sociedad', 'Bienestar': 'Sociedad', 'Clima y Ambiente': 'Sociedad', 'Historias Humanas': 'Sociedad', 'Tendencias Y Vida': 'Sociedad',
  'Inteligencia Artificial': 'Tecnología', 'Ciencia y Espacio': 'Tecnología', 'Apps y Redes': 'Tecnología', 'Innovación': 'Tecnología', 'Videojuegos': 'Tecnología',
  'Cine y Series': 'Entretenimiento/Cultura', 'Música': 'Entretenimiento/Cultura', 'Turismo y Viajes': 'Entretenimiento/Cultura', 'Streaming': 'Entretenimiento/Cultura', 'Autos': 'Entretenimiento/Cultura', 'Viral y Trending': 'Entretenimiento/Cultura', 'Teatro y Literatura': 'Entretenimiento/Cultura',
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
  
  if (topic.split(/\s+/).length >= 3) {
    return topic;
  }

  const currentYear = new Date().getFullYear();

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          // 💥 CORREGIDO 1: Usamos backticks ` para que ${currentYear} se reemplace por 2026
          content: `Sos un asistente de búsqueda para una app de noticias en Argentina en el año ${currentYear}. El usuario te da 1 o 2 palabras. Tu única tarea es devolver un string de 5 a 7 palabras clave altamente descriptivas para buscar noticias en una base vectorizada de ${currentYear}. Si la palabra es un club deportivo o torneo ("copa sudamericana", "boca", "river"), asumí SIEMPRE su significado de fútbol local argentino. Devolvé ÚNICAMENTE las palabras sin puntuación.`
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
    return `${topic} noticias actualidad Argentina`;
  }
}

function includesOpinionKeyword(value) {
  const normalized = normalizeText(value);
  return OPINION_KEYWORDS.some((kw) => normalized.includes(normalizeText(kw)));
}

function isUsableDigestArticle(article, usedUrls, seenEmbeddings = []) {
  if (!article?.url) return false;
  if (usedUrls.has(article.url)) return false;
  if (isOpinionArticle(article)) return false;

  if (article.publishedAt) {
    const pubDate = new Date(article.publishedAt).getTime();
    const diffHours = (Date.now() - pubDate) / (1000 * 60 * 60);
    if (diffHours > MAX_ARTICLE_AGE_HOURS) {
      console.log(`      ⛔ [CADUCIDAD ${Math.round(diffHours)} HS] BLOQUEADO POR EDAD: "${article.neutralTitle || article.title}"\n`);
      return false;
    }
  }

  if (!Array.isArray(article.embedding) || article.embedding.length === 0) {
    return true; 
  }

  const candidateTitle = article.neutralTitle || article.title || "";
  let maxSim = 0;
  let mostSimilarTitle = "";

  for (const seen of seenEmbeddings) {
    if (!Array.isArray(seen.vector) || seen.vector.length === 0) continue;
    
    const similarity = cosineSimilarity(article.embedding, seen.vector);
    if (similarity > maxSim) {
      maxSim = similarity;
      mostSimilarTitle = seen.title;
    }
  }

  if (maxSim >= 0.85) {
    console.log(`      ⛔ [DUPLICADO SEMÁNTICO ${Math.round(maxSim*100)}%] BLOQUEADO:`);
    console.log(`         ❌ Intentó entrar: "${candidateTitle}"`);
    console.log(`         📄 Ya habías leído el evento: "${mostSimilarTitle}"\n`);
    return false;
  } else if (maxSim > 0.50) {
    console.log(`      ✅ [TEMA RELACIONADO PERO EVENTO DISTINTO ${Math.round(maxSim*100)}%] PERMITIDO:`);
    console.log(`         🆕 Entró: "${candidateTitle}"`);
    console.log(`         🔍 Más cercano en historial: "${mostSimilarTitle}"\n`);
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

  if (useCutoff) {
    baseQuery.publishedAt = { $gte: getFreshnessCutoff() };
  }

  const selectFields = [
    '_id', 'title', 'url', 'sourceName', 'section', 'region', 'tags', 'category', 'topic',
    'importanceScore', 'publishedAt', 'neutralTitle', 'neutralLead', 'neutralSummary',
    'neutralityScore', 'politicalBiasRisk', 'curationStatus', 'rawSummary', 'contentSnippet', 'imageUrl', 'embedding'
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

  const { perTopicLimit = 10, alreadyShownUrls = [], alreadyShownTitles = [], seenEmbeddings = [] } = options;

  const usedUrls = new Set(alreadyShownUrls);
  const usedTitles = [...alreadyShownTitles];
  // 💥 CORREGIDO 3: Clonamos el array para ir agregando los vectores de las notas seleccionadas en el mismo resumen
  const dynamicSeenEmbeddings = [...seenEmbeddings]; 
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
      let candidates = await findCandidatesForTopic(topic, perTopicLimit, true);
      bestUnused = candidates.find((article) => isUsableDigestArticle(article, usedUrls, dynamicSeenEmbeddings));

      if (!bestUnused) {
        const category = TOPIC_TO_CATEGORY[topic];
        if (category && category !== topic) {
          candidates = await findCandidatesForTopic(category, perTopicLimit, true);
          bestUnused = candidates.find((article) => isUsableDigestArticle(article, usedUrls, dynamicSeenEmbeddings));
          
          if (bestUnused) {
            usedFallback = true;
            fallbackCategory = category;
          }
        }
      }
    } else {
      try {
        const queryForEmbedding = await expandTopicForEmbedding(trimmedTopic);

        const semanticCandidates = await searchArticlesBySimilarityAtlas(queryForEmbedding, { 
          limit: perTopicLimit * 2,
          minDate: getFreshnessCutoff() 
        });

        const usableSemantic = semanticCandidates.filter(a => isUsableDigestArticle(a, usedUrls, dynamicSeenEmbeddings));

        if (usableSemantic.length > 0) {
          const bestMatch = usableSemantic[0];
          console.log(`🔍 [Tema Libre] "${trimmedTopic}" -> Match: "${bestMatch.title}" | Score: ${bestMatch.score?.toFixed(3)}`);
          
          if (bestMatch.score >= 0.60) {
            bestUnused = bestMatch;
            usedFallback = false;
          } else {
            // 💥 CORREGIDO: Si el score es bajo, caemos a la categoría real del artículo (ej. Deportes), NUNCA a 'General'
            fallbackCategory = bestMatch.category || 'Sociedad';
            let candidates = await findCandidatesForTopic(fallbackCategory, perTopicLimit, true);
            bestUnused = candidates.find((article) => isUsableDigestArticle(article, usedUrls, dynamicSeenEmbeddings));
            usedFallback = true;
            console.warn(`⚠️ Score semántico bajo para "${trimmedTopic}". Fallback a "${fallbackCategory}".`);
          }
        } else {
          // 💥 CORREGIDO: Si no hay vectores, buscamos en Sociedad o Internacional en lugar de una categoría inexistente
          fallbackCategory = 'Sociedad';
          let candidates = await findCandidatesForTopic(fallbackCategory, perTopicLimit, true);
          bestUnused = candidates.find((article) => isUsableDigestArticle(article, usedUrls, dynamicSeenEmbeddings));
          usedFallback = true;
          console.warn(`⚠️ Cero resultados vectoriales para "${trimmedTopic}". Fallback a "${fallbackCategory}".`);
        }
      } catch (error) {
        console.error(`❌ Error en búsqueda semántica para "${trimmedTopic}":`, error);
        usedFallback = true;
      }
    }

    // -------------------------------------------------------------
    // CONSULTA 4: RESCATE DE EMERGENCIA EN MONGODB
    // -------------------------------------------------------------
    if (!bestUnused) {
      console.log(`🚨 [RESCATE] No hubo resultados para "${topic}". Buscando reemplazo de emergencia...`);
      try {
        // 💥 CORREGIDO: Si el tema era deportivo o económico, intentamos rescatar dentro de su misma área general primero
        let emergencyFilter = {
          publishedAt: { $gte: getFreshnessCutoff() },
          topicStatus: 'done',
          importanceScore: { $gte: 40 } // Piso de calidad elevado
        };

        // Si el usuario pedía fútbol, tenis o clubes, restringimos el rescate a Deportes para que no entren crímenes
        const topicLower = normalizeText(topic);
        if (topicLower.includes('river') || topicLower.includes('boca') || topicLower.includes('champions') || topicLower.includes('seleccion') || topicLower.includes('futbol') || topicLower.includes('tenis')) {
          emergencyFilter.category = 'Deportes';
        }

        let emergencyCandidates = await Article.find(emergencyFilter)
          .sort({ importanceScore: -1, publishedAt: -1 })
          .limit(perTopicLimit * 3)
          .select('_id title url sourceName section region tags category topic importanceScore publishedAt neutralTitle neutralLead neutralSummary neutralityScore politicalBiasRisk curationStatus rawSummary contentSnippet imageUrl embedding')
          .lean();

        // Si no encontró de esa categoría específica, abrimos la búsqueda a todo el diario
        if (emergencyCandidates.length === 0 && emergencyFilter.category) {
          delete emergencyFilter.category;
          emergencyCandidates = await Article.find(emergencyFilter)
            .sort({ importanceScore: -1, publishedAt: -1 })
            .limit(perTopicLimit * 3)
            .select('_id title url sourceName section region tags category topic importanceScore publishedAt neutralTitle neutralLead neutralSummary neutralityScore politicalBiasRisk curationStatus rawSummary contentSnippet imageUrl embedding')
            .lean();
        }

        // 💥 CORREGIDO: Aplicamos enrichArticleRanking para que no devuelva puntajeNoticia: 0 en los logs
        const rankedEmergency = emergencyCandidates.map(enrichArticleRanking);

        bestUnused = rankedEmergency.find((article) => isUsableDigestArticle(article, usedUrls, dynamicSeenEmbeddings));
        if (bestUnused) {
          usedFallback = true;
          fallbackCategory = bestUnused.category || 'Sociedad';
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
    
    // 💥 CORREGIDO 3: Guardamos el embedding de esta nota para que el próximo tema del mismo resumen no la repita
    if (Array.isArray(bestUnused.embedding) && bestUnused.embedding.length > 0) {
      dynamicSeenEmbeddings.push({
        title: bestUnused.neutralTitle || bestUnused.title || "",
        vector: bestUnused.embedding
      });
    }
    
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