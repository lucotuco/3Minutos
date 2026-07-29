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
  
  if (topic.split(/\s+/).length >= 5) {
    return topic;
  }

  const currentYear = new Date().getFullYear();

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Sos un motor de expansión de búsqueda para una base de datos vectorial periodística del año ${currentYear}.REGLA SUPREMA: El string que devuelvas DEBE EMPEZAR OBLIGATORIAMENTE con las palabras exactas que escribió el usuario, seguidas de 4 o 5 palabras clave que agreguen contexto o entidades relacionadas. NUNCA reemplaces ni elimines la palabra original. REGLA ANTI-RUIDO: NO agregues palabras genéricas como "historia", "rivalidades", "equipo", "deportivo". Si el usuario pide "leonas", "pumas", "maravillas", asumilos SIEMPRE como selecciones nacionales argentinas de deporte. Devolvé ÚNICAMENTE la cadena en minúsculas sin puntuación.`
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
    country: 'ar',
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
    let queryExpanded = null;

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
      // -------------------------------------------------------------
      // CONSULTA 3: TEMA LIBRE O VECTORES (Con Escudo Léxico y Anti-Alucinación)
      // -------------------------------------------------------------
      try {
        const queryForEmbedding = await expandTopicForEmbedding(trimmedTopic);
        queryExpanded = queryForEmbedding;

        const semanticCandidates = await searchArticlesBySimilarityAtlas(trimmedTopic, queryForEmbedding, { 
          limit: perTopicLimit * 2,
          minDate: getFreshnessCutoff() 
        });

        const usableSemantic = semanticCandidates.filter(a => isUsableDigestArticle(a, usedUrls, dynamicSeenEmbeddings));

        if (usableSemantic.length > 0) {
          const bestMatch = usableSemantic[0];
          console.log(`🔍 [Tema Libre] "${trimmedTopic}" -> Match: "${bestMatch.title}" | Score: ${bestMatch.score?.toFixed(3)}`);
          
          if (bestMatch.score >= 0.60) {
            // -------------------------------------------------------------
            // ESCUDO LÉXICO STRICTO (Anti "Media Palabra")
            // -------------------------------------------------------------
            const topicClean = normalizeText(trimmedTopic);
            const contentToSearch = normalizeText(
              `${bestMatch.title} ${bestMatch.rawSummary} ${bestMatch.contentSnippet} ${(bestMatch.tags || []).join(' ')}`
            );

            // Filtramos palabras con 3 o más letras (para incluir siglas como AFA, FMI, YPF)
            const wordsToMatch = topicClean.split(' ').filter(w => w.length >= 3);
            let hasLexicalMatch = false;

            if (wordsToMatch.length > 0) {
              if (wordsToMatch.length <= 3) {
                // 💥 REGLA DE ORO PARA NOMBRES Y TÉRMINOS CORTOS (1 a 3 palabras):
                // Exigimos que esté la frase completa O que TODAS las palabras clave existan en el texto.
                hasLexicalMatch = contentToSearch.includes(topicClean) || 
                                  wordsToMatch.every(word => contentToSearch.includes(word));
              } else {
                // PARA FRASES LARGAS (4+ palabras): Exigimos al menos el 75% de coincidencia
                const matchedWords = wordsToMatch.filter(word => contentToSearch.includes(word));
                hasLexicalMatch = (matchedWords.length >= Math.ceil(wordsToMatch.length * 0.75)) || 
                                  contentToSearch.includes(topicClean);
              }
            } else {
              hasLexicalMatch = contentToSearch.includes(topicClean);
            }

            bestUnused = bestMatch;
            
            if (hasLexicalMatch) {
              usedFallback = false; // Match real y verificado
            } else {
              usedFallback = true;  // Match indirecto, se prende el banner amarillo
              console.warn(`⚠️ Match semántico indirecto (${bestMatch.score.toFixed(3)}) para "${trimmedTopic}". No contiene el término exacto, se marca como sugerido.`);
            }
          } 
          else {
            fallbackCategory = bestMatch.category || 'Sociedad';
            let candidates = await findCandidatesForTopic(fallbackCategory, perTopicLimit, true);
            bestUnused = candidates.find((article) => isUsableDigestArticle(article, usedUrls, dynamicSeenEmbeddings));
            usedFallback = true;
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
          country: 'ar',
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
        queryExpanded,
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
      queryExpanded,
      article: bestUnused,
      usedFallback,
      fallbackCategory,
    });
  }

  return results;
}

module.exports = { pickBestArticlePerTopic };