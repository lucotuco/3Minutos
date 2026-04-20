const { pickBestArticlePerTopic } = require('../utils/pickBestArticlePerTopic');
const { generateArticleSummaryVariant } = require('../summaries/generateArticleSummaryVariant');

async function buildUserNewsDigest({
  topics = [],
  tone = 'neutro',
  alreadyShownUrls = [],
  perTopicLimit = 10,
  numCandidates = 100,
} = {}) {
  if (!Array.isArray(topics) || topics.length === 0) {
    return {
      tone,
      items: [],
    };
  }

  const picks = await pickBestArticlePerTopic(topics, {
    perTopicLimit,
    numCandidates,
    alreadyShownUrls,
  });

  const items = await Promise.all(
    picks.map(async (pick) => {
      if (!pick.article) {
        return {
          topic: pick.topic,
          articleId: null,
          title: null,
          url: null,
          section: null,
          region: null,
          tags: [],
          summary: null,
          cached: false,
          score: null,
          finalScore: null,
        };
      }

      const summaryResult = await generateArticleSummaryVariant(pick.article._id, tone);

      return {
        topic: pick.topic,
        articleId: String(pick.article._id),
        title: pick.article.title,
        url: pick.article.url,
        section: pick.article.section,
        region: pick.article.region,
        tags: pick.article.tags || [],
        summary: summaryResult.summary,
        cached: summaryResult.cached,
        score: pick.article.score ?? null,
        finalScore: pick.article.finalScore ?? null,
      };
    })
  );

  return {
    tone,
    items,
  };
}

module.exports = {
  buildUserNewsDigest,
};