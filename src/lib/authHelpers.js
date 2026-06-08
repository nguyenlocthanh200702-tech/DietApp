const AUTH_EMAIL_DOMAIN = 'forge.auth';

export function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

export function validateUsername(username) {
  const normalized = normalizeUsername(username);
  if (normalized.length < 3) return 'Username must be at least 3 characters';
  if (normalized.length > 20) return 'Username must be 20 characters or less';
  if (!/^[a-z0-9_]+$/.test(normalized)) {
    return 'Username can only use letters, numbers, and underscores';
  }
  return null;
}

export function usernameToAuthEmail(username) {
  return `${normalizeUsername(username)}@${AUTH_EMAIL_DOMAIN}`;
}

export function getDisplayUsername(user) {
  if (!user) return '';
  if (user.user_metadata?.username) return user.user_metadata.username;
  const email = user.email || '';
  const suffix = `@${AUTH_EMAIL_DOMAIN}`;
  if (email.endsWith(suffix)) return email.slice(0, -suffix.length);
  return email.split('@')[0] || '';
}
