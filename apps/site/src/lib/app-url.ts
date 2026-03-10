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

export const buildAppUrl = (path: string): string => {
  const base = getAppOrigin();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
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
