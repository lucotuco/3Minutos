const { cloudinary } = require('../config/cloudinary');

async function cleanupOldDigestAudios({ todayFolder }) {
  try {
    const result = await cloudinary.api.resources({
      type: 'upload',
      resource_type: 'video',
      prefix: 'digests-audio/',
      max_results: 500,
    });

    const oldResources = (result.resources || []).filter((file) => {
      const publicId = file.public_id || '';
      return publicId.startsWith('digests-audio/') && !publicId.startsWith(`digests-audio/${todayFolder}/`);
    });

    for (const file of oldResources) {
      try {
        await cloudinary.uploader.destroy(file.public_id, {
          resource_type: 'video',
          invalidate: true,
        });
      } catch (error) {
        console.error(`Error borrando ${file.public_id}:`, error.message);
      }
    }
  } catch (error) {
    console.error('Error limpiando audios viejos:', error.message);
  }
}

module.exports = { cleanupOldDigestAudios };