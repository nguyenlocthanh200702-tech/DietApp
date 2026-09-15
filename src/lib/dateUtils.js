let activeTimeZone = 'Asia/Bangkok';

export function setAppTimeZone(timeZone) {
  activeTimeZone = timeZone;
}

export function getAppTimeZone() {
  return activeTimeZone;
}

export function getDateKeyInAppTz(date = new Date(), timeZone = activeTimeZone) {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

export function getTodayKey(timeZone = activeTimeZone) {
  return getDateKeyInAppTz(new Date(), timeZone);
}

export function getMealDateKey(timestamp, timeZone = activeTimeZone) {
  return getDateKeyInAppTz(new Date(timestamp), timeZone);
}

export function isTodayInAppTz(timestamp, timeZone = activeTimeZone) {
  return getMealDateKey(timestamp, timeZone) === getTodayKey(timeZone);
}

export function getLastNDaysKeys(dayCount, timeZone = activeTimeZone) {
  const keys = [];
  const todayKey = getTodayKey(timeZone);
  for (let i = dayCount - 1; i >= 0; i--) {
    keys.push(addDaysToDateKey(todayKey, -i, timeZone));
  }
  return keys;
}

export function isWithinLastDaysInAppTz(timestamp, dayCount, timeZone = activeTimeZone) {
  const mealKey = getMealDateKey(timestamp, timeZone);
  return getLastNDaysKeys(dayCount, timeZone).includes(mealKey);
}

export function getDayOfWeekInAppTz(date = new Date(), timeZone = activeTimeZone) {
  const d = date instanceof Date ? date : new Date(date);
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short'
  }).format(d);
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[weekday];
}

function dateKeyToUtcNoon(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export function addDaysToDateKey(dateKey, days, timeZone = activeTimeZone) {
  const utc = dateKeyToUtcNoon(dateKey);
  utc.setUTCDate(utc.getUTCDate() + days);
  return getDateKeyInAppTz(utc, timeZone);
}

export function getCurrentWeekKeys(timeZone = activeTimeZone) {
  const todayKey = getTodayKey(timeZone);
  const dayOfWeek = getDayOfWeekInAppTz(new Date(), timeZone);
  const keys = [];
  for (let i = 0; i < 7; i++) {
    keys.push(addDaysToDateKey(todayKey, i - dayOfWeek, timeZone));
  }
  return keys;
}

export function getWeekdayLabel(dateKey, timeZone = activeTimeZone) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short'
  }).format(dateKeyToUtcNoon(dateKey));
}
