const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

const Article = require('../models/Article');
const { adaptRssArticle } = require('./adapter/rssAdapter');
const { processArticle } = require('./processArticle');
const { saveNormalizedArticle } = require('./saveNormalizedArticle');
const { reviewArticlesWithAIBatch } = require('./reviewArticlesWithAIBatch');

dotenv.config();

const FALLBACK_IMAGE_URL = 'https://st2.depositphotos.com/1036149/5381/i/950/depositphotos_53811511-stock-illustration-duck-with-sunglasses.jpg';

const parser = new Parser({
  timeout: 30000,
  customFields: {
    item: [
      ['media:content', 'media:content'],
      ['media:thumbnail', 'media:thumbnail'],
      ['image:image', 'image:image'],
      ['content:encoded', 'content:encoded'],
      ['enclosure', 'reformaEnclosure']
    ]
  }
});
const AI_BATCH_SIZE = Number(process.env.AI_BATCH_SIZE || 10);

function loadSources() {
  const filePath = path.join(__dirname, '..', 'Sources.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Mongo conectado a:', mongoose.connection.name);
}

function splitIntoChunks(items = [], chunkSize = 10) {
  const chunks = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

async function saveArticles(articles = []) {
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const article of articles) {
    try {
      const result = await saveNormalizedArticle(article);
      if (result.status === 'created') created++;
      else skipped++;
    } catch (error) {
      errors++;
      console.log(`❌ Error guardando artículo -> ${error.message}`);
    }
  }

  return { created, skipped, errors };
}

async function filterExistingArticles(articles = []) {
  if (!Array.isArray(articles) || articles.length === 0) {
    return {
      newArticles: [],
      duplicateArticles: [],
    };
  }

  const uniqueArticlesMap = new Map();
  const urls = [];
  const titles = [];

  for (const article of articles) {
    if (!article?.url) continue;
    
    // Evitamos procesar dos veces la misma URL en el mismo lote
    if (!uniqueArticlesMap.has(article.url)) {
      uniqueArticlesMap.set(article.url, article);
      urls.push(article.url);
      if (article.title) titles.push(article.title.trim());
    }
  }

  // ⏱️ Límite de tiempo: solo buscamos títulos duplicados en los últimos 3 días 
  // para que la consulta a MongoDB sea rapidísima y no afecte el rendimiento.
  const limiteDias = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  // 💥 LA MAGIA: Buscamos si ya existe la URL o el Título en la base de datos
  const existingArticles = await Article.find({
    $or: [
      { url: { $in: urls } },
      { 
        title: { $in: titles }, 
        createdAt: { $gte: limiteDias } 
      }
    ]
  }).select('url title');

  // Creamos Sets para búsquedas ultrarrápidas en memoria
  const existingUrls = new Set(existingArticles.map((article) => article.url));
  const existingTitles = new Set(existingArticles.map((article) => article.title?.trim()));

  const newArticles = [];
  const duplicateArticles = [];

  for (const article of uniqueArticlesMap.values()) {
    const titleTrimmed = article.title?.trim();
    
    // 🛡️ BARRERA: Si la URL ya existe O el Título ya existe, es un duplicado de agencia
    if (existingUrls.has(article.url) || (titleTrimmed && existingTitles.has(titleTrimmed))) {
      duplicateArticles.push(article);
    } else {
      newArticles.push(article);
    }
  }

  return {
    newArticles,
    duplicateArticles,
  };
}

function buildFallbackReviewedArticles(chunk = [], errorMessage = '') {
  return chunk.map((article) => ({
    ...article,
    aiReviewed: false,
    aiConfidence: 0,
    aiChangedClassification: false,
    aiReason: `AI batch review failed: ${errorMessage}`,
    classificationStatus: 'needs_review',
  }));
}

async function runRssIngestion() {
  const sources = loadSources().filter(
    (source) => source.active && (source.type || 'rss') === 'rss'
  );

  await connectDB();

  try {
    for (const source of sources) {
      let created = 0;
      let skipped = 0;
      let errors = 0;
      let aiBatchCount = 0;

      try {
        const feed = await parser.parseURL(source.url);
        //const items = feed.items || [];
        const top50Items = feed.items.slice(0, 50);
        console.log(`📰 ${source.name} -> ${top50Items.length} items`);

        const processedArticles = [];

        for (const item of top50Items) 
        {
          try {
            const adapted = adaptRssArticle(item, source);

            // NUEVA LÓGICA: Detectar si es la imagen de fallback o un logo de Aurora
            const isFallbackImage = adapted.imageUrl === FALLBACK_IMAGE_URL;
            const isAuroraLogo = adapted.imageUrl && adapted.imageUrl.includes('LOGO-AURORA');

            // Filtrar artículos inválidos
            if (isFallbackImage || isAuroraLogo) {
              console.log(`🦆 Noticia descartada por no tener imagen válida: ${adapted.title}`);
              continue; // Salta a la siguiente noticia, no la guarda en la BD
            }

            const processed = processArticle(adapted, {
              defaultMinScore: 6,
              maxTags: 3,
            });
            processedArticles.push(processed);
          } catch (error) {
            errors++;
            console.log(`❌ ${source.name} -> ${error.message}`);
          }
        }

        const { newArticles, duplicateArticles } = await filterExistingArticles(processedArticles);

        skipped += duplicateArticles.length;

        const aiChunks = splitIntoChunks(newArticles, AI_BATCH_SIZE);
        aiBatchCount = newArticles.length;

        for (const chunk of aiChunks) {
          try {
            const reviewedArticles = await reviewArticlesWithAIBatch(chunk);
            const batchSaveResult = await saveArticles(reviewedArticles);
            created += batchSaveResult.created;
            skipped += batchSaveResult.skipped;
            errors += batchSaveResult.errors;
          } catch (error) {
            console.log(`❌ ${source.name} -> error batch IA: ${error.message}`);

            const fallbackArticles = buildFallbackReviewedArticles(chunk, error.message);
            const fallbackSaveResult = await saveArticles(fallbackArticles);

            created += fallbackSaveResult.created;
            skipped += fallbackSaveResult.skipped;
            errors += fallbackSaveResult.errors;
          }
        }

        console.log(
          `💾 ${source.name} -> creados: ${created}, omitidos: ${skipped}, errores: ${errors}, IA batch: ${aiBatchCount}`
        );
      } catch (error) {
        console.log(`❌ Error procesando feed ${source.name}: ${error.message}`);
      }
    }
  } finally {
    await mongoose.disconnect();
    console.log('✅ Mongo desconectado');
  }
}

runRssIngestion().catch((error) => {
  console.error('❌ Error general RSS:', error.message);
  process.exit(1);
});