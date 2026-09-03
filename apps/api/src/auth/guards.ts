import { FastifyReply, FastifyRequest } from 'fastify';

import { applyAccessTokenFromSessionCookie } from './session-cookies';
import { authStore, type UserRecord } from './store';

const UNAUTHORIZED_RESPONSE = {
  code: 'unauthorized',
  message: 'Authentication required.',
} as const;

const BLOCKED_RESPONSE = {
  code: 'account_blocked',
  message: 'This account has been blocked.',
} as const;

type AuthGuardOptions = {
  blockedBehavior?: 'unauthorized' | 'forbidden';
};

const sendUnauthorized = async (reply: FastifyReply): Promise<void> => {
  await reply.status(401).send(UNAUTHORIZED_RESPONSE);
};

const sendBlocked = async (
  reply: FastifyReply,
  blockedBehavior: AuthGuardOptions['blockedBehavior'],
): Promise<void> => {
  if (blockedBehavior === 'forbidden') {
    await reply.status(403).send(BLOCKED_RESPONSE);
    return;
  }

  await sendUnauthorized(reply);
};

export const requireJwtAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    applyAccessTokenFromSessionCookie(request, 'web');
    await request.jwtVerify();
  } catch {
    await sendUnauthorized(reply);
  }
};

export const getAuthenticatedUserId = (request: FastifyRequest): string | null => {
  if (
    !request.user ||
    typeof request.user !== 'object' ||
    !('sub' in request.user) ||
    typeof request.user.sub !== 'string'
  ) {
    return null;
  }

  return request.user.sub;
};

export const loadAuthenticatedUser = async (
  request: FastifyRequest,
  reply: FastifyReply,
  options: AuthGuardOptions = {},
): Promise<UserRecord | null> => {
  try {
    applyAccessTokenFromSessionCookie(request, 'web');
    await request.jwtVerify();
  } catch {
    await sendUnauthorized(reply);
    return null;
  }

  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    await sendUnauthorized(reply);
    return null;
  }

  const user = await authStore.findUserById(userId);
  if (!user) {
    await sendUnauthorized(reply);
    return null;
  }

  if (user.isBlocked) {
    await sendBlocked(reply, options.blockedBehavior);
    return null;
  }

  return user;
};

export const resolveAuthenticatedUserId = async (
  request: FastifyRequest,
): Promise<string | null> => {
  try {
    applyAccessTokenFromSessionCookie(request, 'web');
    await request.jwtVerify();
  } catch {
    return null;
  }

  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return null;
  }

  const user = await authStore.findUserById(userId);
  if (!user || user.isBlocked) {
    return null;
  }

  return user.id;
};

export const requireAuthenticatedUserId = async (
  request: FastifyRequest,
  reply: FastifyReply,
  options: AuthGuardOptions = {},
): Promise<string | null> => {
  const user = await loadAuthenticatedUser(request, reply, options);
  return user?.id ?? null;
};
