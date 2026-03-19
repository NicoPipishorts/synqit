import { API_URL } from './constants';

const FALLBACK_ORIGIN = 'http://synqit.local';

const normalizeBasePath = (value: string): string => {
  if (!value || value === '/') return '';
  return value.endsWith('/') ? value.slice(0, -1) : value;
};

const toApiConfig = () => {
  const parsed = new URL(API_URL, FALLBACK_ORIGIN);
  const isAbsolute = parsed.origin !== FALLBACK_ORIGIN;

  return {
    basePath: normalizeBasePath(parsed.pathname),
    baseUrl: isAbsolute
      ? normalizeBasePath(`${parsed.origin}${parsed.pathname}`)
      : normalizeBasePath(parsed.pathname),
  };
};

const stripApiBasePath = (pathName: string, apiBasePath: string): string => {
  if (!apiBasePath) return pathName;
  if (pathName === apiBasePath) return '/';
  if (pathName.startsWith(`${apiBasePath}/`)) {
    return pathName.slice(apiBasePath.length) || '/';
  }
  return pathName;
};

export const toApiAssetUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  if (/^(data|blob):/i.test(url)) return url;

  const { basePath, baseUrl } = toApiConfig();

  if (/^https?:\/\//i.test(url)) {
    const parsed = new URL(url);
    const normalizedPath = stripApiBasePath(parsed.pathname, basePath);
    return `${baseUrl}${normalizedPath}${parsed.search}${parsed.hash}`;
  }

  const normalizedPath = stripApiBasePath(
    url.startsWith('/') ? url : `/${url.replace(/^\.?\//, '')}`,
    basePath,
  );
  return `${baseUrl}${normalizedPath}`;
};
