const { normalizeText } = require('../../utils/normalizeText');

function extractImage(item = {}) {
  if (item.enclosure?.url) return item.enclosure.url;
  if (item['media:content']?.$?.url) return item['media:content'].$.url;
  if (item['media:thumbnail']?.$?.url) return item['media:thumbnail'].$.url;
  return '';
}

function extractSummary(item = {}) {
  return (
    item.content ||
    item['content:encoded'] ||
    item.contentSnippet ||
    item.summary ||
    item.description ||
    ''
  );
}

function adaptRssArticle(item = {}, source = {}) {
  const title = item.title || 'Sin título';
  const url = item.link || '';
  const rawSummary = extractSummary(item);

  return {
    sourceName: source.name || 'Fuente RSS',
    sourceType: 'rss',
    sourceUrl: source.url || '',
    title,
    url,
    publishedAt: item.pubDate ? new Date(item.pubDate) : null,
    category: source.category || 'general',
    country: source.country || 'ar',
    language: source.language || 'es',
    author: item.creator || item.author || '',
    rawSummary,
    imageUrl: extractImage(item),
    contentSnippet: item.contentSnippet || item.summary || item.description || '',
    normalizedTitle: normalizeText(title),
    _sourceMeta: {
      type: 'rss',
      source,
      rawItem: item,
    },
  };
}

module.exports = {
  adaptRssArticle,
};