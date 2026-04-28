const Article = require('../models/Article');
const { openai, OPENAI_MODEL } = require('../config/openai');

function buildSummaryPrompt(article) {
  return `
Sos un editor de noticias.

Tu tarea es escribir un resumen MUY corto, claro y útil para una app mobile donde deben entrar 3 noticias en una sola vista.

Reglas obligatorias:
- Escribí 1 o 2 oraciones como máximo.
- Ideal: entre 20 y 35 palabras en total.
- Decí el hecho principal de forma directa.
- Solo agregá contexto si entra en muy pocas palabras.
- No repitas el título.
- No uses introducciones, relleno ni frases genéricas.
- No inventes nada.
- Tiene que entenderse rápido en pantalla chica.

Noticia:
Título: ${article.title || ''}
Sección: ${article.section || ''}
Región: ${article.region || ''}
Tags: ${(article.tags || []).join(', ')}
Resumen fuente: ${article.rawSummary || article.contentSnippet || ''}

Devolvé solo el resumen final.
`.trim();
}

function cleanText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function limitText(value, maxLength = 220) {
  const text = cleanText(value);

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trim()}...`;
}

function buildFallbackSummary(article) {
  const rawSummary = cleanText(article.rawSummary || article.contentSnippet);

  if (rawSummary) {
    return limitText(rawSummary, 220);
  }

  const title = cleanText(article.title);

  if (title) {
    return limitText(title, 180);
  }

  return 'Resumen no disponible por el momento.';
}

function extractResponseText(response) {
  const directText = cleanText(response?.output_text);

  if (directText) {
    return directText;
  }

  const output = Array.isArray(response?.output) ? response.output : [];

  const parts = [];

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];

    for (const contentItem of content) {
      if (contentItem?.type === 'output_text' && contentItem?.text) {
        parts.push(contentItem.text);
      }

      if (contentItem?.type === 'text' && contentItem?.text) {
        parts.push(contentItem.text);
      }
    }
  }

  return cleanText(parts.join(' '));
}

async function saveFallbackSummary(article, errorMessage) {
  const fallbackSummary = buildFallbackSummary(article);

  article.summary = fallbackSummary;
  article.summaryStatus = 'done';
  article.summaryGeneratedAt = new Date();
  article.summaryError = errorMessage || '';

  await article.save();

  return {
    article,
    summary: fallbackSummary,
    cached: false,
    fallback: true,
  };
}

async function generateArticleSummary(articleId) {
  const article = await Article.findById(articleId);

  if (!article) {
    throw new Error('Article not found');
  }

  const existingSummary = cleanText(article.summary);

  if (existingSummary) {
    return {
      article,
      summary: existingSummary,
      cached: true,
      fallback: false,
    };
  }

  const prompt = buildSummaryPrompt(article);

  try {
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: prompt,
      max_output_tokens: 250,
    });

    const summary = extractResponseText(response);

    if (!summary) {
      return saveFallbackSummary(
        article,
        `OpenAI returned empty summary. status=${response?.status || 'unknown'}`
      );
    }

    article.summary = summary;
    article.summaryStatus = 'done';
    article.summaryGeneratedAt = new Date();
    article.summaryError = '';

    await article.save();

    return {
      article,
      summary,
      cached: false,
      fallback: false,
    };
  } catch (error) {
    return saveFallbackSummary(
      article,
      error.message || 'OpenAI summary generation failed'
    );
  }
}

module.exports = {
  generateArticleSummary,
};