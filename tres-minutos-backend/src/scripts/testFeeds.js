const fs = require('fs');
const Parser = require('rss-parser');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const {
  normalizeText,
  getTagAnalysis,
  detectSection,
  detectRegion,
} = require('../utils/tagHelpers');

const Article = require('../models/Article');

dotenv.config();

const parser = new Parser();

const raw = fs.readFileSync('./src/Sources.json', 'utf-8');
const sources = JSON.parse(raw);

async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Mongo conectado a:', process.env.MONGODB_URI);
}

function extractImage(item) {
  if (item.enclosure && item.enclosure.url) {
    return item.enclosure.url;
  }

  if (item['media:content'] && item['media:content'].$ && item['media:content'].$.url) {
    return item['media:content'].$.url;
  }

  return '';
}

function extractSummary(item) {
  return (
    item.content ||
    item['content:encoded'] ||
    item.contentSnippet ||
    item.summary ||
    item.description ||
    ''
  );
}

async function saveFeedItems(source, items) {
  let created = 0;
  let skipped = 0;

  for (const item of items) {
    try {
      const existing = await Article.findOne({ url: item.link });

      if (existing) {
        skipped++;
        continue;
      }

      const articleData = {
        sourceName: source.name,
        sourceUrl: source.url,
        title: item.title || 'Sin título',
        url: item.link,
        publishedAt: item.pubDate ? new Date(item.pubDate) : null,
        category: source.category || 'general',
        country: source.country || 'ar',
        rawSummary: extractSummary(item),
        imageUrl: extractImage(item),
        contentSnippet: item.contentSnippet || item.summary || item.description || '',
      };

      articleData.section = detectSection(source, item);
      articleData.region = detectRegion(articleData);
      articleData.normalizedTitle = normalizeText(articleData.title);

      const tagAnalysis = getTagAnalysis(articleData, {
        defaultMinScore: 6,
        maxTags: 3,
      });

      articleData.tags = tagAnalysis.tags;
      articleData.tagScores = tagAnalysis.tagScores;

      await Article.create(articleData);

      created++;
    } catch (error) {
      console.log(`❌ Error guardando item de ${source.name}: ${error.message}`);
    }
  }

  console.log(`💾 ${source.name} -> creados: ${created}, repetidos: ${skipped}`);
}

async function testFeeds() {
  await connectDB();

  for (const source of sources) {
    if (!source.active) continue;

    try {
      const feed = await parser.parseURL(source.url);
      const items = feed.items || [];

      console.log(`✅ ${source.name} - ${items.length} items`);

      await saveFeedItems(source, items);
    } catch (error) {
      console.log(`❌ ${source.name} - ${error.message}`);
    }
  }

  await mongoose.disconnect();
  console.log('✅ Mongo desconectado');
}

testFeeds();
