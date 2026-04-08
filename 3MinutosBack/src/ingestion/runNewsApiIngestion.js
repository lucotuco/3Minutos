const fs = require('fs');
const path = require('path');
const axios = require('axios');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

const Article = require('../models/Article');
const { adaptNewsApiArticle } = require('./adapter/newsApiAdapter');
const { processArticle } = require('./processArticle');
const { saveNormalizedArticle } = require('./saveNormalizedArticle');
const { reviewArticlesWithAIBatch } = require('./reviewArticlesWithAIBatch');

dotenv.config();

const AI_BATCH_SIZE = Number(process.env.AI_BATCH_SIZE || 10);

function loadSources() {
  const filePath = path.join(__dirname, '..', 'NewsApiSources.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Mongo conectado a:', mongoose.connection.name);
}

async function fetchNewsApiArticles(source) {
  const apiKey = process.env.NEWS_API_KEY;

  if (!apiKey) {
    throw new Error('Falta NEWS_API_KEY en el .env');
  }

  const endpoint =
    source.endpoint === 'everything'
      ? 'https://newsapi.org/v2/everything'
      : 'https://newsapi.org/v2/top-headlines';

  const params = {
    apiKey,
    pageSize: source.pageSize || 20,
    language: source.language || 'es',
  };

  if (source.endpoint === 'everything') {
    if (source.query) params.q = source.query;
    if (source.sortBy) params.sortBy = source.sortBy;
  } else {
    if (source.country) params.country = source.country;
    if (source.newsApiCategory) params.category = source.newsApiCategory;
    if (source.query) params.q = source.query;
  }

  const response = await axios.get(endpoint, { params });
  return response.data?.articles || [];
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

  for (const article of articles) {
    if (!article?.url) continue;
    if (!uniqueArticlesMap.has(article.url)) {
      uniqueArticlesMap.set(article.url, article);
    }
  }

  const uniqueArticles = Array.from(uniqueArticlesMap.values());
  const urls = uniqueArticles.map((article) => article.url);

  const existingArticles = await Article.find({
    url: { $in: urls },
  }).select('url');

  const existingUrls = new Set(existingArticles.map((article) => article.url));

  const newArticles = [];
  const duplicateArticles = [];

  for (const article of uniqueArticles) {
    if (existingUrls.has(article.url)) duplicateArticles.push(article);
    else newArticles.push(article);
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

async function runNewsApiIngestion() {
  const sources = loadSources().filter((source) => source.active);

  await connectDB();

  try {
    for (const source of sources) {
      let created = 0;
      let skipped = 0;
      let errors = 0;
      let aiBatchCount = 0;

      try {
        const items = await fetchNewsApiArticles(source);

        console.log(`📰 ${source.name} -> ${items.length} items`);

        const processedArticles = [];

        for (const item of items) {
          try {
            const adapted = adaptNewsApiArticle(item, source);
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
        console.log(`❌ Error consultando NewsAPI ${source.name}: ${error.message}`);
      }
    }
  } finally {
    await mongoose.disconnect();
    console.log('✅ Mongo desconectado');
  }
}

runNewsApiIngestion().catch((error) => {
  console.error('❌ Error general NewsAPI:', error.message);
  process.exit(1);
});