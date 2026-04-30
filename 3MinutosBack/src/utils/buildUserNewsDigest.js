const { pickBestArticlePerTopic } = require('../utils/pickBestArticlePerTopic');
const { generateArticleSummary } = require('../summaries/generateArticleSummary');

function cleanText(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function limitText(value, maxLength = 220) {
  const text = cleanText(value);

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trim()}...`;
}

function buildFallbackSummary(article) {
  const sourceText = cleanText(article.rawSummary || article.contentSnippet);

  if (sourceText) {
    return limitText(sourceText, 220);
  }

  const title = cleanText(article.title);

  if (title) {
    return limitText(title, 180);
  }

  return 'Resumen no disponible por el momento.';
}

async function buildUserNewsDigest({
  topics = [],
  alreadyShownUrls = [],
  perTopicLimit = 10,
  numCandidates = 100,
} = {}) {
  if (!Array.isArray(topics) || topics.length === 0) {
    return {
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
          fallback: false,
          score: null,
          finalScore: null,
        };
      }

      let summaryResult;

      try {
        summaryResult = await generateArticleSummary(pick.article._id);
      } catch (error) {
        summaryResult = {
          summary: buildFallbackSummary(pick.article),
          cached: false,
          fallback: true,
          error: error.message || 'Summary generation failed',
        };
      }

      return {
        topic: pick.topic,
        articleId: String(pick.article._id),
        title: pick.article.title,
        url: pick.article.url,
        section: pick.article.section,
        region: pick.article.region,
        tags: pick.article.tags || [],
        summary: summaryResult.summary,
        cached: Boolean(summaryResult.cached),
        fallback: Boolean(summaryResult.fallback),
        score: pick.article.score ?? null,
        finalScore: pick.article.finalScore ?? null,
      };
    })
  );

  return {
    items,
  };
}

module.exports = {
  buildUserNewsDigest,
};