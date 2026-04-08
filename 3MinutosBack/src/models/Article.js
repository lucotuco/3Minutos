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
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    aiConfidence: {
      type: Number,
      default: 0,
    },
    importanceScore: {
      type: Number,
      default: 0,
      index: true,
    },
    importanceLevel: {
      type: String,
      default: 'low',
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
    normalizedTitle: {
      type: String,
      default: '',
    },
    embeddingText: {
  type: String,
  default: '',
},

embeddingModel: {
  type: String,
  default: '',
},

embeddingStatus: {
  type: String,
  enum: ['pending', 'done', 'error'],
  default: 'pending',
},

embeddingGeneratedAt: {
  type: Date,
  default: null,
},
embeddingError: {
  type: String,
  default: '',
},
embedding: {
  type: [Number],
  default: [],
},
summaryVariants: {
  type: Map,
  of: String,
  default: {},
},

summaryStatus: {
  type: String,
  enum: ['pending', 'done', 'error'],
  default: 'pending',
},

summaryGeneratedAt: {
  type: Date,
  default: null,
},

summaryError: {
  type: String,
  default: '',
},
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Article', articleSchema, 'articles');