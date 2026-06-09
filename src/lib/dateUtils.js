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
