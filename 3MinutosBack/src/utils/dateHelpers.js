function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseTimeToMinutes(time = '') {
  const [hours, minutes] = String(time).split(':').map(Number);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
}

function getMinutesNow(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

module.exports = {
  getLocalDateString,
  parseTimeToMinutes,
  getMinutesNow,
};