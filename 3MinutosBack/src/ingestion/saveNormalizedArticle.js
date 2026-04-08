const Article = require('../models/Article');
const { processArticleEmbedding } = require('../embeddings/processArticleEmbedding');

async function saveNormalizedArticle(article = {}) {
  if (!article.url) {
    return {
      status: 'skipped',
      reason: 'missing_url',
    };
  }

  const existingByUrl = await Article.findOne({ url: article.url }).select('_id url');
  if (existingByUrl) {
    return {
      status: 'skipped',
      reason: 'duplicate_url',
    };
  }

  const created = await Article.create(article);
  await processArticleEmbedding(created._id);

  return {
    status: 'created',
    articleId: created._id,
    aiReviewed: created.aiReviewed,
    classificationStatus: created.classificationStatus,
  };
}

module.exports = {
  saveNormalizedArticle,
};