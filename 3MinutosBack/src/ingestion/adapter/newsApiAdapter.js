const { normalizeText } = require('../../utils/normalizeText');

function adaptNewsApiArticle(item = {}, sourceConfig = {}) {
  const title = item.title || 'Sin título';
  const url = item.url || '';

  return {
    sourceName: item.source?.name || sourceConfig.name || 'NewsAPI',
    sourceType: 'newsapi',
    sourceUrl: sourceConfig.baseUrl || 'https://newsapi.org',
    title,
    url,
    publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
    category: sourceConfig.category || 'general',
    country: sourceConfig.country || 'global',
    language: sourceConfig.language || 'es',
    author: item.author || '',
    rawSummary: item.description || item.content || '',
    imageUrl: item.urlToImage || '',
    contentSnippet: item.content || item.description || '',
    normalizedTitle: normalizeText(title),
    _sourceMeta: {
      type: 'newsapi',
      source: sourceConfig,
      rawItem: item,
    },
  };
}

module.exports = {
  adaptNewsApiArticle,
};