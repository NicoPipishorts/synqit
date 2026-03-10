const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const getConfiguredAdminUrl = (): string | null => {
  const configured = import.meta.env.VITE_ADMIN_URL?.trim();
  return configured ? trimTrailingSlash(configured) : null;
};

export const getAdminOrigin = (): string => {
  const configured = getConfiguredAdminUrl();
  if (configured) {
    return configured;
  }

  if (typeof window === 'undefined') {
    return 'http://127.0.0.1:4174';
  }

  const { protocol, hostname } = window.location;

  if (hostname === '127.0.0.1') {
    return `${protocol}//127.0.0.1:4174`;
  }

  if (hostname === 'localhost') {
    return `${protocol}//localhost:4174`;
  }

  if (hostname.startsWith('admin.')) {
    return `${protocol}//${hostname}`;
  }

  if (hostname.startsWith('app.')) {
    return `${protocol}//admin.${hostname.slice(4)}`;
  }

  return `${protocol}//admin.${hostname}`;
};

export const buildAdminAppUrl = (path: string): string => {
  const base = getAdminOrigin();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
};
