const Article = require('../models/Article');
const { generateArticleEmbedding } = require('../embeddings/generateArticleEmbeddings');

async function processArticleEmbedding(articleOrId) {
  const articleId =
    typeof articleOrId === 'string'
      ? articleOrId
      : articleOrId?._id;

  if (!articleId) {
    throw new Error('Article id not found');
  }

  const article = await Article.findById(articleId);

  if (!article) {
    throw new Error('Article not found');
  }

  if (!article.embeddingText || !String(article.embeddingText).trim()) {
    article.embeddingStatus = 'error';
    article.embeddingError = 'Missing embeddingText';
    await article.save();
    return article;
  }

  try {
    const result = await generateArticleEmbedding(article);

    article.embedding = result.vector;
    article.embeddingModel = result.embeddingModel;
    article.embeddingStatus = 'done';
    article.embeddingGeneratedAt = new Date();
    article.embeddingError = '';

    await article.save();
    return article;
  } catch (error) {
    article.embeddingStatus = 'error';
    article.embeddingError = error.message || 'Unknown embedding error';
    await article.save();
    return article;
  }
}

module.exports = {
  processArticleEmbedding,
};