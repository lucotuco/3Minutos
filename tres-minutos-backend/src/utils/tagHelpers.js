const TAG_RULES = require('./tagRules');

function decodeEntities(text = '') {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripHtml(text = '') {
  return decodeEntities(
    text
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<[^>]*>/g, ' ')
  );
}

function normalizeText(text = '') {
  return stripHtml(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(text = '') {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countWholeWordMatches(text, term) {
  if (!text || !term) return 0;
  const regex = new RegExp(`(^|\\s)${escapeRegex(term)}(?=\\s|$)`, 'g');
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

function hasPhrase(text, phrase) {
  return Boolean(text && phrase && text.includes(phrase));
}

function normalizeSectionName(section = '') {
  const value = normalizeText(section);
  const sectionMap = {
    espectaculos: 'entretenimiento',
    entretenimiento: 'entretenimiento',
    deportes: 'deportes',
    tecnologia: 'tecnologia',
    economia: 'economia',
    finanzas: 'finanzas',
    politica: 'politica',
    mundo: 'mundo',
    autos: 'autos',
    lifestyle: 'lifestyle',
    negocios: 'negocios',
    nacional: 'nacional',
    energia: 'energia',
    'real estate': 'real-estate',
    real_estate: 'real-estate',
  };
  return sectionMap[value] || value || 'general';
}

function detectSection(source = {}, item = {}) {
  const sourceCategory = normalizeSectionName(source.category || '');
  const sourceName = normalizeText(source.name || '');
  const url = (item.link || '').toLowerCase();

  if (url.includes('/espectaculos/')) return 'entretenimiento';
  if (url.includes('/deportes/')) return 'deportes';
  if (url.includes('/tecnologia/')) return 'tecnologia';
  if (url.includes('/economia/')) return 'economia';
  if (url.includes('/finanzas/')) return 'finanzas';
  if (url.includes('/politica/')) return 'politica';
  if (url.includes('/mundo/')) return 'mundo';
  if (url.includes('/autos/')) return 'autos';
  if (url.includes('/lifestyle/')) return 'lifestyle';
  if (url.includes('/negocios/')) return 'negocios';
  if (url.includes('/nacional/')) return 'nacional';
  if (url.includes('/energia/')) return 'energia';
  if (url.includes('/real-estate/')) return 'real-estate';
  if (url.includes('/municipios/')) return 'nacional';

  if (sourceName.includes('espectaculos')) return 'entretenimiento';
  if (sourceName.includes('deportes')) return 'deportes';
  if (sourceName.includes('tecnologia')) return 'tecnologia';
  if (sourceName.includes('economia')) return 'economia';
  if (sourceName.includes('finanzas')) return 'finanzas';
  if (sourceName.includes('politica')) return 'politica';
  if (sourceName.includes('mundo')) return 'mundo';
  if (sourceName.includes('autos')) return 'autos';
  if (sourceName.includes('lifestyle')) return 'lifestyle';
  if (sourceName.includes('negocios')) return 'negocios';
  if (sourceName.includes('municipios')) return 'nacional';
  if (sourceName.includes('nacional')) return 'nacional';
  if (sourceName.includes('novedades fiscales')) return 'economia';

  return sourceCategory || 'general';
}

function buildRegionScoringHaystack(article = {}) {
  return normalizeText([
    article.title || '',
    article.rawSummary || '',
    article.contentSnippet || '',
    article.url || '',
    article.sourceName || '',
    article.section || '',
  ].join(' '));
}

function scoreRegion(text, config) {
  let score = 0;

  for (const term of config.strong || []) {
    const normalized = normalizeText(term);
    const matches = countWholeWordMatches(text, normalized);
    if (matches > 0) score += matches * 5;
    else if (normalized.includes(' ') && hasPhrase(text, normalized)) score += 4;
  }

  for (const term of config.weak || []) {
    const normalized = normalizeText(term);
    const matches = countWholeWordMatches(text, normalized);
    if (matches > 0) score += matches * 2;
    else if (normalized.includes(' ') && hasPhrase(text, normalized)) score += 2;
  }

  for (const phrase of config.phrases || []) {
    const normalized = normalizeText(phrase);
    if (hasPhrase(text, normalized)) score += 6;
  }

  return score;
}

function detectRegion(article = {}) {
  const text = buildRegionScoringHaystack(article);
  const section = normalizeText(article.section || '');

  const regionConfigs = {
    argentina: {
      strong: [
        'argentina', 'argentino', 'argentina', 'caba', 'buenos aires', 'banco provincia', 'anses', 'arca', 'bcra',
        'afa', 'liga profesional', 'copa argentina', 'seleccion argentina', 'bombonera', 'monumental', 'casa rosada',
        'congreso', 'senado', 'diputados', 'javier milei', 'karina milei', 'kicillof', 'macri', 'river', 'boca', 'san lorenzo'
      ],
      weak: ['nacion', 'provincia', 'porteño', 'bonaerense', 'caba', 'chapadmalal', 'gran rex', 'coto', 'cuenta dni'],
      phrases: ['ciudad de buenos aires', 'banco provincia', 'los pumas', 'controladores aereos'],
    },
    'medio-oriente': {
      strong: ['iran', 'israel', 'libano', 'teheran', 'qatar', 'arabia saudita', 'emiratos arabes unidos', 'golfo persico'],
      weak: ['ormuz', 'irani', 'regimen irani'],
      phrases: ['medio oriente', 'estrecho de ormuz'],
    },
    latam: {
      strong: ['brasil', 'mexico', 'uruguay', 'chile', 'colombia', 'venezuela', 'ecuador', 'paraguay', 'peru', 'bolivia'],
      weak: ['latinoamerica', 'sudamerica', 'concacaf'],
      phrases: ['america latina'],
    },
    europa: {
      strong: ['union europea', 'europa', 'francia', 'alemania', 'espana', 'italia', 'polonia', 'reino unido', 'inglaterra'],
      weak: ['bruselas', 'ue'],
      phrases: ['union europea'],
    },
    eeuu: {
      strong: ['eeuu', 'estados unidos', 'wall street', 'reserva federal', 'pentagono', 'texas', 'miami', 'super bowl'],
      weak: ['fed', 'washington', 'hollywood', 'oscar'],
      phrases: ['estados unidos'],
    },
    africa: {
      strong: ['senegal', 'marruecos', 'africa', 'caf'],
      weak: [],
      phrases: ['copa de africa'],
    },
  };

  const scored = Object.entries(regionConfigs)
    .map(([region, config]) => ({ region, score: scoreRegion(text, config) }))
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  if (!top || top.score < 6) {
    if (section === 'politica' || section === 'economia' || section === 'finanzas' || section === 'nacional' || section === 'real-estate' || section === 'autos') {
      return 'argentina';
    }
    return 'global';
  }

  return top.region;
}

function buildWeightedTexts(article = {}) {
  return {
    title: normalizeText(article.title || ''),
    summary: normalizeText(article.rawSummary || ''),
    snippet: normalizeText(article.contentSnippet || ''),
    category: normalizeText(article.category || ''),
    section: normalizeText(article.section || ''),
    sourceName: normalizeText(article.sourceName || ''),
    region: normalizeText(article.region || ''),
  };
}

function containsExclusion(rule, weightedTexts) {
  const haystack = [weightedTexts.title, weightedTexts.summary, weightedTexts.snippet, weightedTexts.section, weightedTexts.sourceName].join(' ');
  return (rule.excludePhrases || []).some((phrase) => hasPhrase(haystack, normalizeText(phrase)));
}

function shouldAllowPartialMatch(keyword) {
  return keyword.includes(' ') || keyword.length >= 7;
}

function addKeywordScore(keywords = [], text, exactWeight, partialWeight) {
  let score = 0;
  for (const keyword of keywords) {
    const normalizedKeyword = normalizeText(keyword);
    if (!normalizedKeyword) continue;
    const exactMatches = countWholeWordMatches(text, normalizedKeyword);
    if (exactMatches > 0) {
      score += exactMatches * exactWeight;
      continue;
    }
    if (shouldAllowPartialMatch(normalizedKeyword) && text.includes(normalizedKeyword)) {
      score += partialWeight;
    }
  }
  return score;
}

function addPhraseScore(phrases = [], text, weight) {
  let score = 0;
  for (const phrase of phrases) {
    const normalizedPhrase = normalizeText(phrase);
    if (hasPhrase(text, normalizedPhrase)) score += weight;
  }
  return score;
}

function addContextBoosts(rule, weightedTexts) {
  let score = 0;
  if (rule.sections?.includes(weightedTexts.section)) score += 3;
  if (rule.categories?.includes(weightedTexts.category)) score += 1;
  if (rule.regions?.includes(weightedTexts.region)) score += 2;
  if (rule.sourceNames?.some((name) => weightedTexts.sourceName.includes(normalizeText(name)))) score += 2;
  return score;
}

function scoreRule(rule, weightedTexts) {
  let score = 0;
  score += addKeywordScore(rule.strongKeywords, weightedTexts.title, 5, 3);
  score += addKeywordScore(rule.strongKeywords, weightedTexts.summary, 3, 2);
  score += addKeywordScore(rule.strongKeywords, weightedTexts.snippet, 2, 1);
  score += addKeywordScore(rule.weakKeywords, weightedTexts.title, 2, 1);
  score += addKeywordScore(rule.weakKeywords, weightedTexts.summary, 1, 1);
  score += addKeywordScore(rule.weakKeywords, weightedTexts.snippet, 1, 1);
  score += addPhraseScore(rule.phrases, weightedTexts.title, 6);
  score += addPhraseScore(rule.phrases, weightedTexts.summary, 4);
  score += addPhraseScore(rule.phrases, weightedTexts.snippet, 3);
  score += addContextBoosts(rule, weightedTexts);
  return score;
}

function getTagAnalysis(article, options = {}) {
  const maxTags = options.maxTags || 3;
  const defaultMinScore = options.defaultMinScore || 6;
  const weightedTexts = buildWeightedTexts(article);
  const scoredTags = [];

  for (const rule of TAG_RULES) {
    if (containsExclusion(rule, weightedTexts)) continue;
    const score = scoreRule(rule, weightedTexts);
    const minScore = rule.minScore || defaultMinScore;
    if (score >= minScore) scoredTags.push({ tag: rule.tag, score });
  }

  scoredTags.sort((a, b) => b.score - a.score || a.tag.localeCompare(b.tag));
  const limited = scoredTags.slice(0, maxTags);
  const tagScores = {};
  for (const item of limited) tagScores[item.tag] = item.score;

  return { tags: limited.map((item) => item.tag), tagScores, scoredTags: limited };
}

function extractTags(article, options = {}) {
  return getTagAnalysis(article, options).tags;
}

module.exports = {
  normalizeText,
  extractTags,
  getTagAnalysis,
  stripHtml,
  decodeEntities,
  detectSection,
  detectRegion,
  normalizeSectionName,
};
