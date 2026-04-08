const Article = require('../models/Article');
const { enrichArticleRanking } = require('./articleRanking');

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeQueryValue(value = '') {
  return String(value).trim();
}

function buildArticleQuery(filters = {}) {
  const query = {};

  if (filters.section) {
    query.Section = normalizeQueryValue(filters.section);
  }

  if (filters.region) {
    query.Region = normalizeQueryValue(filters.region);
  }

  if (filters.category) {
    query.category = normalizeQueryValue(filters.category);
  }

  if (filters.tag) {
    const safeTag = escapeRegex(normalizeQueryValue(filters.tag));
    query.Tags = {
      $elemMatch: {
        $regex: `^${safeTag}$`,
        $options: 'i',
      },
    };
  }

  if (filters.sourceName) {
    query.sourceName = normalizeQueryValue(filters.sourceName);
  }

  if (filters.fromDate || filters.toDate) {
    query.publishedAt = {};

    if (filters.fromDate) {
      query.publishedAt.$gte = new Date(filters.fromDate);
    }

    if (filters.toDate) {
      query.publishedAt.$lte = new Date(filters.toDate);
    }
  }

  return query;
}

async function getTopArticles(filters = {}, options = {}) {
  const limit = Math.min(Number(options.limit || 5), 50);
  const candidateLimit = Math.min(Number(options.candidateLimit || 200), 500);

  const mongoQuery = buildArticleQuery(filters);

  const candidates = await Article.find(mongoQuery)
    .sort({ publishedAt: -1 })
    .limit(candidateLimit)
    .lean();

  const ranked = candidates
    .map(enrichArticleRanking)
    .sort((a, b) => {
      if (b.rankingScore !== a.rankingScore) {
        return b.rankingScore - a.rankingScore;
      }

      const aPublished = new Date(a.publishedAt || 0).getTime();
      const bPublished = new Date(b.publishedAt || 0).getTime();

      return bPublished - aPublished;
    })
    .slice(0, limit)
    .map((article) => ({
      _id: article._id,
      title: article.title,
      url: article.url,
      sourceName: article.sourceName,
      publishedAt: article.publishedAt,
      category: article.category,
      Section: article.Section,
      Region: article.Region,
      Tags: article.Tags,
      importanceScore: article.importanceScore || 0,
      importanceLevel: article.importanceLevel || 'low',
      freshnessScore: article.freshnessScore,
      rankingScore: article.rankingScore,
      contentSnippet: article.contentSnippet || '',
      imageUrl: article.imageUrl || '',
    }));

  return ranked;
}

module.exports = {
  getTopArticles,
};