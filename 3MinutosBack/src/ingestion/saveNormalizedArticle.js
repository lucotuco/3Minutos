const Article = require('../models/Article');
const { classifyArticleTopic } = require('./classifyArticleTopic');
const { buildEmbeddingText } = require('../embeddings/buildEmbeddingsText');
const { generateArticleEmbedding } = require('../embeddings/generateArticleEmbeddings');
const { cosineSimilarity } = require('../embeddings/searchArticlesBySimilarity');

async function saveNormalizedArticle(article = {}) {
  if (!article.url) {
    return { status: 'skipped', reason: 'missing_url' };
  }

  // =========================================================
  // FASE 1: Filtro Exacto de URL (Costo $0)
  // =========================================================
  const existingByUrl = await Article.findOne({ url: article.url }).select('_id url');
  if (existingByUrl) {
    return { status: 'skipped', reason: 'duplicate_url' };
  }

  // =========================================================
  // FASE 2: Deduplicación Semántica (Vectorial)
  // =========================================================
  // 1. Armamos el texto y generamos el vector en el aire
  article.embeddingText = buildEmbeddingText(article);
  let newVector = [];
  let embeddingModel = '';

  try {
    const result = await generateArticleEmbedding(article);
    newVector = result.vector;
    embeddingModel = result.embeddingModel;
  } catch (error) {
    console.error(`❌ Error generando vector temporal para "${article.title}":`, error.message);
    return { status: 'skipped', reason: 'embedding_failed' };
  }

  // 2. Buscamos candidatos similares en Atlas (solo los de las últimas 72 horas)
  const limiteDias = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const candidates = await Article.aggregate([
    {
      $vectorSearch: {
        index: 'articles_embedding_index',
        path: 'embedding',
        queryVector: newVector,
        numCandidates: 150,
        limit: 15,
        filter: { publishedAt: { $gte: limiteDias } }
      }
    },
    {
      $project: { title: 1, embedding: 1 }
    }
  ]);

  // 3. Validación matemática exacta en Node.js (85% de similitud)
  for (const candidate of candidates) {
    const similarity = cosineSimilarity(newVector, candidate.embedding);
    if (similarity >= 0.92) {
      console.log(`⛔ [Fase 2] Duplicado semántico bloqueado (Similitud: ${(similarity * 100).toFixed(1)}%):`);
      console.log(`   ❌ Entrante: "${article.title}"`);
      console.log(`   📄 Existente: "${candidate.title}"`);
      return { status: 'skipped', reason: 'semantic_duplicate' };
    }
  }

  // =========================================================
  // FASE 3: Clasificación Inteligente
  // =========================================================
  let category = 'Sociedad', topic = 'General', geoScope = 'Global';
  try {
    const classification = await classifyArticleTopic(article);
    category = classification.category;
    topic = classification.topic;
    geoScope = classification.geoScope || 'Global';
  } catch (error) {
    console.error(`❌ Error en clasificación IA para "${article.title}":`, error.message);
  }

  // =========================================================
  // FASE 4: Guardado Final en MongoDB
  // =========================================================
  // Guardamos la noticia terminada con vector y clasificación de una sola vez
  const created = await Article.create({
    ...article,
    category,
    topic,
    geoScope,
    topicStatus: 'done',
    topicGeneratedAt: new Date(),
    topicModel: 'gpt-4o-mini',
    
    curationStatus: article.curationStatus || 'pending',
    biasAnalysis: article.biasAnalysis || '',
    neutralTitle: article.neutralTitle || '',
    neutralLead: article.neutralLead || '',
    neutralSummary: article.neutralSummary || '',
    neutralityScore: article.neutralityScore || 0,
    politicalBiasRisk: article.politicalBiasRisk || 'unknown',
    curationError: '',
    curationGeneratedAt: null,
    curationModel: '',
    
    // Inyectamos el vector calculado en Fase 2
    embeddingText: article.embeddingText,
    embedding: newVector,
    embeddingModel,
    embeddingStatus: 'done',
    embeddingGeneratedAt: new Date(),
    embeddingError: '',
  });

  return {
    status: 'created',
    articleId: created._id,
    classificationStatus: created.classificationStatus,
    curationStatus: created.curationStatus,
  };
}

module.exports = { saveNormalizedArticle };