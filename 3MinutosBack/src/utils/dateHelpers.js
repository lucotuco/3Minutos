const APP_TIME_ZONE = 'America/Argentina/Buenos_Aires';

function getPartsInTimeZone(date = new Date(), timeZone = APP_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const map = {};

  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }

  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour,
    minute: map.minute,
  };
}

function getLocalDateString(date = new Date(), timeZone = APP_TIME_ZONE) {
  const parts = getPartsInTimeZone(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function parseTimeToMinutes(time = '') {
  const [hours, minutes] = String(time).split(':').map(Number);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
}

function getMinutesNow(date = new Date(), timeZone = APP_TIME_ZONE) {
  const parts = getPartsInTimeZone(date, timeZone);
  return Number(parts.hour) * 60 + Number(parts.minute);
}

module.exports = {
  APP_TIME_ZONE,
  getLocalDateString,
  parseTimeToMinutes,
  getMinutesNow,
};