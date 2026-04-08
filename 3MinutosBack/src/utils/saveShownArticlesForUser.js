const UserShownArticle = require('../models/UserShownArticle');

async function saveShownArticlesForUser(userId, digestItems = [], tone = '') {
  const ops = [];

  for (const item of digestItems) {
    if (!item?.articleId || !item?.url) continue;

    ops.push({
      updateOne: {
        filter: {
          userId,
          articleUrl: item.url,
        },
        update: {
          $setOnInsert: {
            userId,
            articleId: item.articleId,
            articleUrl: item.url,
            topic: item.topic || '',
            tone: tone || '',
            shownAt: new Date(),
          },
        },
        upsert: true,
      },
    });
  }

  if (!ops.length) return;

  await UserShownArticle.bulkWrite(ops);
}

module.exports = {
  saveShownArticlesForUser,
};