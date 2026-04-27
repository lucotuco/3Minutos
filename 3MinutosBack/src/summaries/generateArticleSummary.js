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

async function generateArticleSummary(articleId) {
  const article = await Article.findById(articleId);

  if (!article) {
    throw new Error('Article not found');
  }

  const existingSummary = String(article.summary || '').trim();
  if (existingSummary) {
    return {
      article,
      summary: existingSummary,
      cached: true,
    };
  }

  const prompt = buildSummaryPrompt(article);

  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    input: prompt,
    max_output_tokens: 90,
  });

  const summary = response.output_text?.trim?.() || '';

  if (!summary) {
    article.summaryStatus = 'error';
    article.summaryError = 'Empty summary response';
    await article.save();
    throw new Error('Empty summary response');
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
  };
}

module.exports = {
  generateArticleSummary,
};