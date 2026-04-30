const Article = require('../models/Article');
const { openai, OPENAI_MODEL } = require('../config/openai');

function stripHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanText(value) {
  return stripHtml(value)
    .replace(/\s+/g, ' ')
    .trim();
}

function buildFallbackSummary(article) {
  const sourceText = cleanText(article.rawSummary || article.contentSnippet);

  if (sourceText) {
    return sourceText;
  }

  const title = cleanText(article.title);

  if (title) {
    return title;
  }

  return 'Resumen no disponible por el momento.';
}

function buildSummaryPrompt(article) {
  const title = cleanText(article.title);
  const sourceText = cleanText(article.rawSummary || article.contentSnippet);

  return `
Sos un editor de noticias para una app mobile llamada 3 Minutos.

Tu tarea es escribir un resumen corto, claro y útil.

Reglas obligatorias:
- Escribí 1 o 2 oraciones.
- Preferentemente entre 20 y 45 palabras.
- Si la noticia necesita un poco más para entenderse, podés extenderte, pero no uses relleno.
- Decí el hecho principal de forma directa.
- No repitas el título literalmente.
- No uses introducciones.
- No uses HTML.
- No uses listas.
- No inventes datos.
- No termines con puntos suspensivos.
- El resumen debe quedar completo, no cortado.

Noticia:
Título: ${title}
Sección: ${article.section || ''}
Región: ${article.region || ''}
Tags: ${(article.tags || []).join(', ')}
Texto fuente: ${sourceText}

Devolvé solo el resumen final.
`.trim();
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
      max_output_tokens: 400,
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