import { getAppOrigin } from './app-url';

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

// The marketing site lives on the root domain, the API on the app origin. We
// need an absolute URL (the web app can use a same-origin `/api` proxy; the site
// cannot). Prefer an explicit VITE_API_URL, otherwise derive `${appOrigin}/api`
// to match the web app's default API mount.
export const getApiBaseUrl = (): string => {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured) {
    return trimTrailingSlash(configured);
  }

  return `${trimTrailingSlash(getAppOrigin())}/api`;
};
