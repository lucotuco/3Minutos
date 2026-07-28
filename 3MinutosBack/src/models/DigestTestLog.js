const mongoose = require('mongoose');

const DigestTestLogSchema = new mongoose.Schema(
  {
    idUsuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserPreference',
      required: true,
      index: true,
    },
    motivo: {
      type: String,
      default: 'refresh', // Puedes usar 'refresh', 'cron', etc.
    },
    noticias: [
      {
        topicoUsuario: { type: String, default: '' },
        queryExpanded: { type: String, default: null },
        titulo: { type: String, default: '' },
        summaryLead: { type: String, default: '' },
        summary: { type: String, default: '' },
        publishedAt: { type: Date, default: null },
        categoria: { type: String, default: '' },
        puntajeNoticia: { type: Number, default: 0 },
      }
    ],
  },
  { timestamps: true } // Agrega createdAt y updatedAt automáticamente
);

// Índice para poder filtrar y limpiar logs fácilmente por fecha
DigestTestLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('DigestTestLog', DigestTestLogSchema, 'digest_test_logs');