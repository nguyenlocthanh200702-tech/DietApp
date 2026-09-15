export const TIMEZONE_PROFILES = [
  {
    key: 'local',
    title: 'Southeast Asia',
    subtitle: 'UTC+7 · Bangkok, Hanoi, Jakarta (Asia/Bangkok)',
    getTimeZone: () => 'Asia/Bangkok'
  },
  {
    key: 'brantford',
    title: 'Brantford, Canada',
    subtitle: 'Eastern Time (America/Toronto)',
    getTimeZone: () => 'America/Toronto'
  }
];

export function getTimezoneProfile(key) {
  return TIMEZONE_PROFILES.find(p => p.key === key) || TIMEZONE_PROFILES[0];
}

export function getTimeZoneForProfileKey(key) {
  return getTimezoneProfile(key).getTimeZone();
}

export function getTimezonePreferenceStorageKey(userId) {
  return `forgeTimezonePreference:${userId}`;
}

export function loadStoredTimezoneKey(userId) {
  const stored =
    localStorage.getItem(getTimezonePreferenceStorageKey(userId))
    || localStorage.getItem(`forgeActiveProfile:${userId}`);
  if (stored && TIMEZONE_PROFILES.some(p => p.key === stored)) {
    return stored;
  }
  return 'local';
}

export function storeTimezoneKey(userId, profileKey) {
  localStorage.setItem(getTimezonePreferenceStorageKey(userId), profileKey);
}

export function formatTimeZoneLabel(timeZone) {
  try {
    const offset = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset'
    }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value;
    return offset ? `${timeZone} (${offset})` : timeZone;
  } catch {
    return timeZone;
  }
}
