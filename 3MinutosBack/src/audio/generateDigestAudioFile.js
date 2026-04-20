const fs = require('fs');
const path = require('path');
const { openai } = require('../config/openai');

async function generateDigestAudioFile({ script, outputPath }) {
  const response = await openai.audio.speech.create({
    model: 'gpt-4o-mini-tts',
    voice: 'alloy',
    input: script,
  });

  const buffer = Buffer.from(await response.arrayBuffer());

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);

  return outputPath;
}

module.exports = { generateDigestAudioFile };