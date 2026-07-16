const UserShownArticle = require('../models/UserShownArticle');
const UserDeliveryRun = require('../models/UserDeliveryRun'); // 👈 Importamos los envíos automáticos

async function getAlreadyShownUrlsForUser(userId) {
  const items = await UserShownArticle.find({ userId }).select('articleUrl -_id').lean();
  return items.map((item) => item.articleUrl).filter(Boolean);
}

async function getAlreadyShownHistoryForUser(userId) {
  // 1. Obtenemos lo que el usuario activamente scrolleó/vio en la app
  const shownItems = await UserShownArticle.find({ userId })
    .select('articleUrl title -_id')
    .lean();

  const urls = shownItems.map((item) => item.articleUrl).filter(Boolean);
  const titles = shownItems.map((item) => item.title).filter(Boolean);

  // 2. Obtenemos TODOS los resúmenes que el backend le generó históricamente (Cronjob y Refresh)
  const deliveryRuns = await UserDeliveryRun.find({ 
    userId, 
    digest: { $ne: null } 
  }).select('digest -_id').lean();

  // 3. Extraemos las URLs y títulos de todos esos resúmenes pasados
  for (const run of deliveryRuns) {
    let items = [];
    if (Array.isArray(run?.digest?.digest?.items)) {
      items = run.digest.digest.items;
    } else if (Array.isArray(run?.digest?.items)) {
      items = run.digest.items;
    }

    for (const item of items) {
      if (item.url) urls.push(item.url);
      if (item.neutralTitle) titles.push(item.neutralTitle);
      else if (item.title) titles.push(item.title);
    }
  }

  // 4. Devolvemos las listas limpias (eliminando duplicados cruzados entre el front y el back)
  return {
    urls: [...new Set(urls)],
    titles: [...new Set(titles)],
  };
}

module.exports = {
  getAlreadyShownUrlsForUser,
  getAlreadyShownHistoryForUser,
};