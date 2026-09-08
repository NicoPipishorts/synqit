const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

/**
 * Origin of the marketing site. The app lives on `app.<domain>`, the site on the
 * root domain, so a cross-origin link is the only way back (no shared router).
 */
export const getSiteOrigin = (): string => {
  const configured = import.meta.env.VITE_SITE_URL?.trim();
  if (configured) {
    return trimTrailingSlash(configured);
  }

  if (typeof window === 'undefined') {
    return 'http://127.0.0.1:4173';
  }

  const { protocol, hostname } = window.location;
  if (hostname === '127.0.0.1' || hostname === 'localhost') {
    return `${protocol}//${hostname === 'localhost' ? 'localhost' : '127.0.0.1'}:4173`;
  }

  return `${protocol}//${hostname.replace(/^app\./, '')}`;
};

/** Absolute URL to a marketing-site path, e.g. `buildSiteUrl('/faq#skipped')`. */
export const buildSiteUrl = (path: string): string =>
  `${getSiteOrigin()}${path.startsWith('/') ? path : `/${path}`}`;
