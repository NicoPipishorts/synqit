const APP_ROUTE_PREFIXES = [
  '/',
  '/auth',
  '/dashboard',
  '/profile',
  '/providers',
  '/playlists',
  '/playlist',
  '/synced-lists',
  '/sync',
  '/events',
  '/event',
] as const;

const UUID_SEGMENT_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NUMERIC_ID_SEGMENT_RE = /^\d{4,}$/;
const OPAQUE_ID_SEGMENT_RE = /^(?=.*\d)[A-Za-z0-9_-]{12,}$/;

const isDynamicSegment = (value: string | null | undefined): boolean => {
  if (!value) {
    return false;
  }

  const segment = value.trim();
  if (!segment) {
    return false;
  }

  return (
    UUID_SEGMENT_RE.test(segment) ||
    NUMERIC_ID_SEGMENT_RE.test(segment) ||
    OPAQUE_ID_SEGMENT_RE.test(segment)
  );
};

const parsePath = (rawPath: string) => {
  try {
    return new URL(rawPath, 'https://admin.synqit.local');
  } catch {
    return null;
  }
};

export const isDisplayableAnalyticsPath = (
  rawPath: string,
  options?: { appOnly?: boolean; includeAdmin?: boolean },
): boolean => {
  const parsed = parsePath(rawPath);
  if (!parsed) {
    return false;
  }

  const pathname = parsed.pathname;
  if (!options?.includeAdmin && pathname.startsWith('/admin')) {
    return false;
  }

  if (options?.appOnly) {
    const isAppRoute = APP_ROUTE_PREFIXES.some((prefix) =>
      prefix === '/' ? pathname === '/' : pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
    if (!isAppRoute) {
      return false;
    }
  }

  const segments = pathname.split('/').filter(Boolean);
  if (segments.some((segment) => isDynamicSegment(segment))) {
    return false;
  }

  const hasDynamicIdQuery = Array.from(parsed.searchParams.entries()).some(([key, value]) =>
    key.toLowerCase().endsWith('id') ? isDynamicSegment(value) : false,
  );

  if (hasDynamicIdQuery) {
    return false;
  }

  return true;
};
