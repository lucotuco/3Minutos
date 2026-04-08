const mongoose = require('mongoose');

const UserPreferenceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    topics: {
      type: [String],
      default: [],
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0 && value.length <= 3,
        message: 'topics must contain between 1 and 3 items',
      },
    },
    tone: {
      type: String,
      enum: ['neutro', 'cercano', 'especialista', 'breve'],
      default: 'neutro',
    },
    deliveryTime: {
      type: String,
      default: '08:00',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  'UserPreference',
  UserPreferenceSchema,
  'user_preferences'
);