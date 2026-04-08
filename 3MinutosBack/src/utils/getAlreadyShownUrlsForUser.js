const UserShownArticle = require('../models/UserShownArticle');

async function getAlreadyShownUrlsForUser(userId) {
  const items = await UserShownArticle.find({ userId })
    .select('articleUrl -_id')
    .lean();

  return items.map((item) => item.articleUrl).filter(Boolean);
}

module.exports = {
  getAlreadyShownUrlsForUser,
};