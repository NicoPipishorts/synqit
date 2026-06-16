const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const normalizeSiteHostname = (hostname: string): string => hostname.replace(/^www\./, '');

const getConfiguredAppUrl = (): string | null => {
  const configured = import.meta.env.VITE_APP_URL?.trim();
  return configured ? trimTrailingSlash(configured) : null;
};

export const getAppOrigin = (): string => {
  const configured = getConfiguredAppUrl();
  if (configured) {
    return configured;
  }

  if (typeof window === 'undefined') {
    return 'http://127.0.0.1:5173';
  }

  const { protocol } = window.location;
  const hostname = normalizeSiteHostname(window.location.hostname);

  if (hostname === '127.0.0.1') {
    return `${protocol}//127.0.0.1:5173`;
  }

  if (hostname === 'localhost') {
    return `${protocol}//app.localhost`;
  }

  if (hostname.startsWith('app.')) {
    return `${protocol}//${hostname}`;
  }

  return `${protocol}//app.${hostname}`;
};

// Keep in sync with LOCALE_STORAGE_KEY in lib/i18n.tsx. The marketing site and
// the app live on different subdomains (synqit.com vs app.synqit.com), so they
// do NOT share localStorage. We forward the chosen locale in the URL so the app
// can pick it up and stay consistent with the site.
const LOCALE_STORAGE_KEY = 'synqit.site.locale.v1';

const resolveLocale = (): 'en' | 'fr' | null => {
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (stored === 'en' || stored === 'fr') {
        return stored;
      }
    } catch {
      // Ignore storage access failures.
    }
  }

  if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('fr')) {
    return 'fr';
  }

  return null;
};

export const buildAppUrl = (path: string): string => {
  const base = getAppOrigin();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${base}${normalizedPath}`;

  const locale = resolveLocale();
  if (!locale) {
    return url;
  }

  const separator = normalizedPath.includes('?') ? '&' : '?';
  return `${url}${separator}lang=${locale}`;
};

const APP_PATH_PREFIXES = [
  '/auth',
  '/auth/',
  '/admin',
  '/dashboard',
  '/playlists',
  '/playlist/',
  '/profile',
  '/providers',
  '/synced-lists',
  '/event/',
  '/events',
];

export const shouldRedirectToApp = (pathname: string): boolean =>
  APP_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
