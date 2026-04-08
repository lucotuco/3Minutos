const mongoose = require('mongoose');

const UserShownArticleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    articleId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    articleUrl: {
      type: String,
      required: true,
      index: true,
    },
    topic: {
      type: String,
      default: '',
    },
    tone: {
      type: String,
      default: '',
    },
    shownAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

UserShownArticleSchema.index(
  { userId: 1, articleUrl: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  'UserShownArticle',
  UserShownArticleSchema,
  'user_shown_articles'
);