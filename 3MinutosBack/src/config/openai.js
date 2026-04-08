const path = require('path');
const dotenv = require('dotenv');
const OpenAI = require('openai');

dotenv.config({
  path: path.resolve(__dirname, '../../.env'),
  override: true,
});

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error('Falta OPENAI_API_KEY en el archivo .env');
}

const openai = new OpenAI({
  apiKey,
});

module.exports = {
  openai,
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-5-mini',
};