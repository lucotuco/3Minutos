function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function getHoursDiff(date) {
  if (!date) return 9999;

  const published = new Date(date).getTime();
  const now = Date.now();

  if (Number.isNaN(published)) return 9999;

  return Math.max(0, (now - published) / (1000 * 60 * 60));
}

function getFreshnessScore(publishedAt) {
  const hours = getHoursDiff(publishedAt);

  if (hours <= 3) return 100;
  if (hours <= 6) return 95;
  if (hours <= 12) return 85;
  if (hours <= 24) return 70;
  if (hours <= 48) return 50;
  if (hours <= 72) return 35;
  if (hours <= 168) return 20;
  return 10;
}

function getRankingScore(article = {}) {
  let importanceScore = Number(article.importanceScore || 0);
  const freshnessScore = getFreshnessScore(article.publishedAt);
  const hoursOld = getHoursDiff(article.publishedAt);

  // LA REGLA UNIVERSAL DE CADUCIDAD
  // Detectamos palabras clave típicas de noticias "útiles solo antes de que ocurran"
  const title = String(article.title || '').toLowerCase();
  const isPreview = title.includes('en vivo') || 
                    title.includes('a qué hora') || 
                    title.includes('a que hora') || 
                    title.includes('dónde ver') || 
                    title.includes('donde ver') || 
                    title.includes('minuto a minuto') || 
                    title.includes('formaciones');

  // Si es una previa o minuto a minuto, y pasaron más de 4 horas, la noticia ya es basura.
  if (isPreview && hoursOld > 4) {
    importanceScore = importanceScore * 0.2; // Le destruimos el puntaje (lo bajamos al 20%)
  }

  const rankingScore = clamp(
    importanceScore * 0.6 + freshnessScore * 0.4,
    0,
    100
  );

  return {
    importanceScore,
    freshnessScore,
    rankingScore: Number(rankingScore.toFixed(2)),
  };
}

function enrichArticleRanking(article = {}) {
  const scores = getRankingScore(article);

  return {
    ...article,
    ...scores,
  };
}

module.exports = {
  getFreshnessScore,
  getRankingScore,
  enrichArticleRanking,
};