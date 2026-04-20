function buildDigestAudioScript({ userName, items = [] }) {
  const intro = userName
    ? `Buen día, ${userName}. Estas son tus tres noticias de hoy.`
    : `Buen día. Estas son tus tres noticias de hoy.`;

  const body = items
    .filter((item) => item?.title || item?.summary)
    .map((item, index) => {
      const order =
        index === 0 ? 'Primera noticia' :
        index === 1 ? 'Segunda noticia' :
        'Tercera noticia';

      const title = item.title ? `${item.title}.` : '';
      const summary = item.summary ? `${item.summary}` : '';

      return `${order}. ${title} ${summary}`.trim();
    })
    .join(' ');

  return `${intro} ${body}`.trim();
}

module.exports = { buildDigestAudioScript };