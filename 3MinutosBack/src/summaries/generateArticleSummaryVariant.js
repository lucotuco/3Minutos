const Article = require('../models/Article');
const { openai, OPENAI_MODEL } = require('../config/openai');

function buildSummaryPrompt(article, tone) {
  const toneInstructions = {
    neutro:
      'Escribí un resumen claro, directo y equilibrado, con tono periodístico neutral.',
    cercano:
      'Escribí un resumen claro, natural y cercano, fácil de leer, sin sonar infantil.',
    especialista:
      'Escribí un resumen con más precisión y contexto técnico, manteniéndolo entendible.',
    breve:
      'Escribí un resumen muy corto, concreto y útil, en 1 o 2 frases.',
  };

  return `
Sos un editor de noticias.
Tu tarea es escribir una síntesis informativa breve pero sustanciosa de la noticia.

Reglas:
- Escribí entre 2 y 4 oraciones.
- No repitas el título ni lo parafrasees apenas de no ser necesario.
- Incluí el dato principal de forma explícita.
- Sumá contexto o consecuencia cuando esté disponible.
- Si la noticia es deportiva, incluí claramente el resultado o el hecho deportivo principal.
- Si la noticia es de turismo/lifestyle, explicá qué lugar o propuesta menciona y por qué puede interesar.
- Si la noticia es económica o política, explicá qué cambió, qué se espera o por qué importa.
- No inventes datos.
- No uses frases vacías ni genéricas.
- El texto tiene que dejar al usuario con una idea bastante clara de la noticia, no solo con una pista.
${toneInstructions[tone] || toneInstructions.neutro}

Noticia:
Título: ${article.title || ''}
Sección: ${article.section || ''}
Región: ${article.region || ''}
Tags: ${(article.tags || []).join(', ')}
Resumen fuente: ${article.rawSummary || article.contentSnippet || ''}

Devolvé solo el resumen final.
`.trim();
}

async function generateArticleSummaryVariant(articleId, tone = 'neutro') {
  const article = await Article.findById(articleId);

  if (!article) {
    throw new Error('Article not found');
  }

  const existing = article.summaryVariants?.get?.(tone);
  if (existing) {
    return {
      article,
      summary: existing,
      cached: true,
    };
  }

  const prompt = buildSummaryPrompt(article, tone);

  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    input: prompt,
  });

  const summary =
    response.output_text?.trim?.() ||
    '';

  if (!summary) {
    article.summaryStatus = 'error';
    article.summaryError = `Empty summary for tone: ${tone}`;
    await article.save();
    throw new Error('Empty summary response');
  }

  article.summaryVariants.set(tone, summary);
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
  generateArticleSummaryVariant,
};