const express = require('express');
const Article = require('../models/Article');
const { getTopArticles } = require('../utils/getTopArticles');
//const { pickArticlesForTopics } = require('../utils/pickArticlesForTopics');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const {
      section,
      region,
      tag,
      sourceName,
      country,
      category,
      limit,
    } = req.query;

    const filters = {};

    if (section) filters.section = section;
    if (region) filters.region = region;
    if (tag) filters.tags = tag;
    if (sourceName) filters.sourceName = sourceName;
    if (country) filters.country = country;

    if (!section && category) {
      filters.category = category;
    }

    const parsedLimit = Math.min(Number(limit) || 50, 100);

    const articles = await Article.find(filters)
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(parsedLimit)
      .select(
        'title sourceName category Section Region publishedAt url Tags TagScores rawSummary importanceScore importanceLevel'
      );

    res.json({
      total: articles.length,
      filters: {
        section: section || null,
        region: region || null,
        tag: tag || null,
        sourceName: sourceName || null,
        country: country || null,
        category: !section && category ? category : null,
        limit: parsedLimit,
      },
      articles,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al obtener artículos',
      details: error.message,
    });
  }
});

router.get('/top', async (req, res) => {
  try {
    const {
      tag,
      region,
      section,
      category,
      sourceName,
      fromDate,
      toDate,
      limit,
      candidateLimit,
    } = req.query;

    const articles = await getTopArticles(
      {
        tag,
        region,
        section,
        category,
        sourceName,
        fromDate,
        toDate,
      },
      {
        limit: limit || 5,
        candidateLimit: candidateLimit || 200,
      }
    );

    res.json({
      ok: true,
      count: articles.length,
      filters: {
        tag: tag || null,
        region: region || null,
        section: section || null,
        category: category || null,
        sourceName: sourceName || null,
        fromDate: fromDate || null,
        toDate: toDate || null,
      },
      items: articles,
    });
  } catch (error) {
    console.error('[GET /api/articles/top]', error);

    res.status(500).json({
      ok: false,
      error: 'Error getting top articles',
      message: error.message,
    });
  }
});
/*router.post('/pick-for-topics', async (req, res) => {
  try {
    const { topics, candidateLimit } = req.body;

    if (!Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'topics must be a non-empty array',
      });
    }

    const items = await pickArticlesForTopics(topics, {
      candidateLimit: candidateLimit || 60,
    });

    return res.json({
      ok: true,
      count: items.length,
      items,
    });
  } catch (error) {
    console.error('[POST /api/articles/pick-for-topics]', error);

    return res.status(500).json({
      ok: false,
      error: 'Error picking articles for topics',
      message: error.message,
    });
  }
});*/

module.exports = router;