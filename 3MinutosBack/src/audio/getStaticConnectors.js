const fs = require('fs');
const path = require('path');
const os = require('os');
const { generateDigestAudioFile } = require('./generateDigestAudioFile');
const { uploadDigestAudio } = require('./uploadDigestAudio');

// Caché en memoria RAM para no consultar a Cloudinary/API en cada request
let cachedConnectors = null;

async function getStaticConnectors() {
  if (cachedConnectors && cachedConnectors.length === 3) {
    return cachedConnectors;
  }

  const connectorsConfig = [
    { text: "Primera noticia.", key: "static-connectors/noticia-1" },
    { text: "Segunda noticia.", key: "static-connectors/noticia-2" },
    { text: "Tercera noticia.", key: "static-connectors/noticia-3" },
  ];

  console.log('🔗 [CONNECTORS] Verificando / generando audios conectores estáticos...');

  const results = await Promise.all(
    connectorsConfig.map(async (item, idx) => {
      const tempPath = path.join(os.tmpdir(), `connector-${idx + 1}.mp3`);
      
      try {
        // Generamos el MP3 estático y lo subimos a Cloudinary.
        // Al usar overwrite: true con el mismo public_id, una vez creado 
        // Cloudinary solo lo actualiza o lo devuelve rapidísimo.
        await generateDigestAudioFile({ script: item.text, outputPath: tempPath });
        const uploadRes = await uploadDigestAudio(tempPath, item.key);
        
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        return uploadRes?.audioUrl || null;
      } catch (e) {
        console.error(`❌ Error creando conector "${item.text}":`, e.message);
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        return null;
      }
    })
  );

  // Si se lograron obtener los 3 audios con éxito, los guardamos en memoria RAM
  if (results.every(Boolean)) {
    cachedConnectors = results;
  }

  return results;
}

module.exports = { getStaticConnectors };