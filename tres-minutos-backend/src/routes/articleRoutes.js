const express = require('express');
const Article = require('../models/Article');

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
      .select('title sourceName category section region publishedAt url tags tagScores rawSummary');

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

module.exports = router;
