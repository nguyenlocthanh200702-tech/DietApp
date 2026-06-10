// App timezone: UTC+7 (Bangkok, Hanoi, Jakarta)
export const APP_TIMEZONE = 'Asia/Bangkok';

export function getDateKeyInAppTz(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

export function getTodayKey() {
  return getDateKeyInAppTz(new Date());
}

export function getMealDateKey(timestamp) {
  return getDateKeyInAppTz(new Date(timestamp));
}

export function isTodayInAppTz(timestamp) {
  return getMealDateKey(timestamp) === getTodayKey();
}

export function getLastNDaysKeys(dayCount) {
  const keys = [];
  const now = new Date();
  for (let i = dayCount - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    keys.push(getDateKeyInAppTz(d));
  }
  return keys;
}

export function isWithinLastDaysInAppTz(timestamp, dayCount) {
  const mealKey = getMealDateKey(timestamp);
  return getLastNDaysKeys(dayCount).includes(mealKey);
}

export function getDayOfWeekInAppTz(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    weekday: 'short'
  }).format(d);
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[weekday];
}

export function addDaysToDateKey(dateKey, days) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const ms = Date.UTC(y, m - 1, d, 5, 0, 0) + days * 24 * 60 * 60 * 1000;
  return getDateKeyInAppTz(new Date(ms));
}

// Current calendar week: Sunday → Saturday (UTC+7)
export function getCurrentWeekKeys() {
  const todayKey = getTodayKey();
  const dayOfWeek = getDayOfWeekInAppTz(new Date());
  const keys = [];
  for (let i = 0; i < 7; i++) {
    keys.push(addDaysToDateKey(todayKey, i - dayOfWeek));
  }
  return keys;
}

export function getWeekdayLabel(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    weekday: 'short'
  }).format(new Date(Date.UTC(y, m - 1, d, 5, 0, 0)));
}
