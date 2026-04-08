const { searchArticlesBySimilarityAtlas } = require('../embeddings/searchArticlesBySimilarityAtlas');

async function pickBestArticlePerTopic(topics = [], options = {}) {
  if (!Array.isArray(topics) || topics.length === 0) {
    return [];
  }

  const {
    perTopicLimit = 10,
    numCandidates = 100,
    alreadyShownUrls = [],
  } = options;

  const usedUrls = new Set(alreadyShownUrls);
  const results = [];

  for (const rawTopic of topics) {
    const topic = String(rawTopic || '').trim();
    if (!topic) continue;

    const candidates = await searchArticlesBySimilarityAtlas(topic, {
      limit: perTopicLimit,
      vectorLimit: perTopicLimit,
      numCandidates,
    });

    const bestUnused = candidates.find(
      (article) => article?.url && !usedUrls.has(article.url)
    );

    if (!bestUnused) {
      results.push({
        topic,
        article: null,
      });
      continue;
    }

    usedUrls.add(bestUnused.url);

    results.push({
      topic,
      article: bestUnused,
    });
  }

  return results;
}

module.exports = {
  pickBestArticlePerTopic,
};