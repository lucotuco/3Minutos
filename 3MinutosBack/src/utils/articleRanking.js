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

  // Curva de tiempo ajustada: Premia fuerte lo de hoy, pero no mata lo de anoche de inmediato.
  if (hours <= 2) return 100;  // Recién salido del horno
  if (hours <= 6) return 90;   // Muy fresco (esta mañana/tarde)
  if (hours <= 12) return 80;  // De anoche o ayer a la tarde
  if (hours <= 24) return 65;  // De hace exactamente un día
  if (hours <= 36) return 50;  // Día y medio
  if (hours <= 48) return 35;  // Dos días
  if (hours <= 72) return 20;  // Tres días
  if (hours <= 168) return 10; // Una semana
  return 0;
}

function getRankingScore(article = {}) {
  let importanceScore = Number(article.importanceScore || 0);
  const freshnessScore = getFreshnessScore(article.publishedAt);
  const hoursOld = getHoursDiff(article.publishedAt);

  // LA REGLA UNIVERSAL DE CADUCIDAD (Mantenemos esto para matar las previas viejas)
  const title = String(article.title || '').toLowerCase();
  const isPreview = title.includes('en vivo') || 
                    title.includes('a qué hora') || 
                    title.includes('a que hora') || 
                    title.includes('dónde ver') || 
                    title.includes('donde ver') || 
                    title.includes('minuto a minuto') || 
                    title.includes('formaciones');

  if (isPreview && hoursOld > 4) {
    importanceScore = importanceScore * 0.2; // Destruimos el puntaje de notas vencidas
  }

  // Equilibrio ideal: 70% Valor periodístico (IA) + 30% Novedad (Reloj)
  const rankingScore = clamp(
    importanceScore * 0.70 + freshnessScore * 0.30,
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