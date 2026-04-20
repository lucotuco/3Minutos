const { cloudinary } = require('../config/cloudinary');

async function uploadDigestAudio(localFilePath, storageKey) {
  const result = await cloudinary.uploader.upload(localFilePath, {
    resource_type: 'video',
    public_id: storageKey.replace(/\.mp3$/, ''),
    overwrite: true,
    folder: undefined,
  });

  return {
    audioUrl: result.secure_url,
    audioStorageKey: result.public_id,
  };
}

module.exports = { uploadDigestAudio };