const mongoose = require('mongoose');

const globalContextSchema = new mongoose.Schema({
  summary: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

globalContextSchema.index({ createdAt: 1 }, { expireAfterSeconds: 172800 });

module.exports = mongoose.model('GlobalContext', globalContextSchema);