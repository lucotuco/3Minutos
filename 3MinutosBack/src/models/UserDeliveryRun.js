const mongoose = require('mongoose');

const UserDeliveryRunSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserPreference',
      required: true,
      index: true,
    },
    deliveryDate: {
      type: String,
      required: true,
      index: true,
    },
    deliveryTime: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['created', 'in_progress', 'prepared', 'sent', 'error'],
      default: 'created',
      index: true,
    },
    digest: {
      type: Object,
      default: null,
    },
    preparedAt: {
      type: Date,
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    errorMessage: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

UserDeliveryRunSchema.index(
  { userId: 1, deliveryDate: 1, deliveryTime: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  'UserDeliveryRun',
  UserDeliveryRunSchema,
  'user_delivery_runs'
);