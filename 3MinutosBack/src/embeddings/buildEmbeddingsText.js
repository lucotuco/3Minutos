function buildEmbeddingText(article = {}) {
  const summary = article.rawSummary || article.contentSnippet || '';

  const parts = [
    article.section ? `Sección: ${article.section}` : '',
    article.region ? `Región: ${article.region}` : '',
    Array.isArray(article.tags) && article.tags.length
      ? `Tags: ${article.tags.join(', ')}`
      : '',
    article.title ? `Título: ${article.title}` : '',
    summary ? `Resumen: ${summary}` : '',
  ];

  return parts.filter(Boolean).join('\n').trim();
}

module.exports = { buildEmbeddingText };