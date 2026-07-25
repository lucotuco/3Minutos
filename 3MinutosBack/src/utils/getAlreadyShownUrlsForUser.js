const UserShownArticle = require('../models/UserShownArticle');
const UserDeliveryRun = require('../models/UserDeliveryRun'); 
const Article = require('../models/Article');

async function getAlreadyShownUrlsForUser(userId) {
  const items = await UserShownArticle.find({ userId }).select('articleUrl -_id').lean();
  return items.map((item) => item.articleUrl).filter(Boolean);
}

// En getAlreadyShownUrlsForUser.js
async function getAlreadyShownHistoryForUser(userId) {
  // 1. Lo que vio en la app (traemos el artículo completo o su embedding)
  const shownItems = await UserShownArticle.find({ userId })
    .sort({ shownAt: -1 })
    .limit(30) // Solo necesitamos comparar contra las 30 más recientes
    .select('articleUrl articleId -_id')
    .lean();

  const urls = shownItems.map((i) => i.articleUrl).filter(Boolean);
  const articleIds = shownItems.map((i) => i.articleId).filter(Boolean);

  // 2. Buscamos los embeddings reales de esas notas en la BD
  const pastArticles = await Article.find({ _id: { $in: articleIds } })
    .select('title embedding -_id')
    .lean();

  const seenEmbeddings = pastArticles
    .filter((a) => Array.isArray(a.embedding) && a.embedding.length > 0)
    .map((a) => ({ title: a.title, vector: a.embedding }));

  return {
    urls: [...new Set(urls)],
    seenEmbeddings,
  };
}

module.exports = {
  getAlreadyShownUrlsForUser,
  getAlreadyShownHistoryForUser,
};