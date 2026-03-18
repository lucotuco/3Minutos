const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema(
  {
    sourceName: {
      type: String,
      required: true,
    },
    sourceType: {
      type: String,
      default: 'rss',
      index: true,
    },
    sourceUrl: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    publishedAt: {
      type: Date,
      default: null,
      index: true,
    },
    category: {
      type: String,
      default: 'general',
    },
    section: {
      type: String,
      default: 'general',
      index: true,
    },
    region: {
      type: String,
      default: 'global',
      index: true,
    },
    country: {
      type: String,
      default: 'ar',
    },
    language: {
      type: String,
      default: 'es',
    },
    author: {
      type: String,
      default: '',
    },
    rawSummary: {
      type: String,
      default: '',
    },
    imageUrl: {
      type: String,
      default: '',
    },
    contentSnippet: {
      type: String,
      default: '',
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    tagScores: {
      type: Map,
      of: Number,
      default: {},
    },
    normalizedTitle: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Article', articleSchema);
