import type { FastifyReply, FastifyRequest } from 'fastify';
import { randomBytes } from 'node:crypto';

type SessionScope = 'web' | 'admin';

type SessionCookieTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenMaxAgeSeconds: number;
  refreshTokenMaxAgeSeconds: number;
};

type SessionCookieNames = {
  access: string;
  refresh: string;
  csrf: string;
};

const COOKIE_NAMES: Record<SessionScope, SessionCookieNames> = {
  web: {
    access: 'synqit_web_access',
    refresh: 'synqit_web_refresh',
    csrf: 'synqit_web_csrf',
  },
  admin: {
    access: 'synqit_admin_access',
    refresh: 'synqit_admin_refresh',
    csrf: 'synqit_admin_csrf',
  },
};
const COOKIE_SESSION_SENTINEL = 'Bearer __cookie_session__';
const CSRF_HEADER_NAME = 'x-synqit-csrf-token';

const parseBoolean = (raw: string | undefined, fallback: boolean): boolean => {
  if (!raw) {
    return fallback;
  }

  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
};

const shouldUseSecureCookies = (): boolean =>
  parseBoolean(process.env.AUTH_COOKIE_SECURE, process.env.NODE_ENV === 'production');

const serializeCookie = (params: {
  name: string;
  value: string;
  maxAgeSeconds: number;
  expiresAt: Date;
  httpOnly?: boolean;
}): string => {
  const parts = [
    `${params.name}=${encodeURIComponent(params.value)}`,
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${params.maxAgeSeconds}`,
    `Expires=${params.expiresAt.toUTCString()}`,
  ];

  if (params.httpOnly !== false) {
    parts.push('HttpOnly');
  }

  if (shouldUseSecureCookies()) {
    parts.push('Secure');
  }

  return parts.join('; ');
};

const serializeCookieClear = (name: string, httpOnly = true): string => {
  const parts = [
    `${name}=`,
    'Path=/',
    'SameSite=Lax',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ];

  if (httpOnly) {
    parts.push('HttpOnly');
  }

  if (shouldUseSecureCookies()) {
    parts.push('Secure');
  }

  return parts.join('; ');
};

const appendSetCookieHeader = (reply: FastifyReply, cookies: string[]): void => {
  const existing = reply.getHeader('set-cookie');
  const next = Array.isArray(existing)
    ? [...existing.map(String), ...cookies]
    : existing
      ? [String(existing), ...cookies]
      : cookies;

  reply.header('set-cookie', next);
};

const parseCookies = (rawCookieHeader: string | undefined): Map<string, string> => {
  const cookies = new Map<string, string>();
  if (!rawCookieHeader) {
    return cookies;
  }

  for (const part of rawCookieHeader.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const name = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    try {
      cookies.set(name, decodeURIComponent(value));
    } catch {
      cookies.set(name, value);
    }
  }

  return cookies;
};

export const getCookieNames = (scope: SessionScope) => COOKIE_NAMES[scope];

export const createCsrfToken = (): string => randomBytes(24).toString('base64url');

export const getSessionAccessTokenFromRequest = (
  request: FastifyRequest,
  scope: SessionScope,
): string | null => {
  const cookies = parseCookies(request.headers.cookie);
  return cookies.get(getCookieNames(scope).access) ?? null;
};

export const getSessionRefreshTokenFromRequest = (
  request: FastifyRequest,
  scope: SessionScope,
): string | null => {
  const cookies = parseCookies(request.headers.cookie);
  return cookies.get(getCookieNames(scope).refresh) ?? null;
};

export const getSessionCsrfTokenFromRequest = (
  request: FastifyRequest,
  scope: SessionScope,
): string | null => {
  const cookies = parseCookies(request.headers.cookie);
  return cookies.get(getCookieNames(scope).csrf) ?? null;
};

export const applyAccessTokenFromSessionCookie = (
  request: FastifyRequest,
  scope: SessionScope,
): void => {
  const headerValue = request.headers.authorization;
  const hasAuthorization =
    typeof headerValue === 'string' &&
    headerValue.length > 0 &&
    headerValue !== COOKIE_SESSION_SENTINEL;
  if (hasAuthorization) {
    return;
  }

  const accessToken = getSessionAccessTokenFromRequest(request, scope);
  if (!accessToken) {
    return;
  }

  request.headers.authorization = `Bearer ${accessToken}`;
};

export const setSessionCookies = (
  reply: FastifyReply,
  scope: SessionScope,
  tokens: SessionCookieTokens & { csrfToken?: string | null },
): void => {
  const names = getCookieNames(scope);
  const now = Date.now();
  const csrfToken = tokens.csrfToken ?? createCsrfToken();
  appendSetCookieHeader(reply, [
    serializeCookie({
      name: names.access,
      value: tokens.accessToken,
      maxAgeSeconds: tokens.accessTokenMaxAgeSeconds,
      expiresAt: new Date(now + tokens.accessTokenMaxAgeSeconds * 1000),
    }),
    serializeCookie({
      name: names.refresh,
      value: tokens.refreshToken,
      maxAgeSeconds: tokens.refreshTokenMaxAgeSeconds,
      expiresAt: new Date(now + tokens.refreshTokenMaxAgeSeconds * 1000),
    }),
    serializeCookie({
      name: names.csrf,
      value: csrfToken,
      maxAgeSeconds: tokens.refreshTokenMaxAgeSeconds,
      expiresAt: new Date(now + tokens.refreshTokenMaxAgeSeconds * 1000),
      httpOnly: false,
    }),
  ]);
};

export const clearSessionCookies = (reply: FastifyReply, scope: SessionScope): void => {
  const names = getCookieNames(scope);
  appendSetCookieHeader(reply, [
    serializeCookieClear(names.access),
    serializeCookieClear(names.refresh),
    serializeCookieClear(names.csrf, false),
  ]);
};

export const shouldEnforceCsrfForRequest = (
  request: FastifyRequest,
  scope: SessionScope,
): boolean => {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return false;
  }

  return (
    getSessionAccessTokenFromRequest(request, scope) !== null ||
    getSessionRefreshTokenFromRequest(request, scope) !== null
  );
};

export const hasValidCsrfToken = (request: FastifyRequest, scope: SessionScope): boolean => {
  const cookieToken = getSessionCsrfTokenFromRequest(request, scope);
  if (!cookieToken) {
    return false;
  }

  const headerValue = request.headers[CSRF_HEADER_NAME];
  const requestToken = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  return (
    typeof requestToken === 'string' && requestToken.length > 0 && requestToken === cookieToken
  );
};
