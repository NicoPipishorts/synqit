import { createAuthStore, getInitials } from '@synqit/client';
import type { AdminPermissionLevel, AdminPermissionScope } from '@synqit/shared';

import { API_URL } from './constants';

/** Admin-scoped session store (cookie `synqit_admin_csrf`, `/v1/admin/me`, `/v1/admin/auth/refresh`). */
export const authStore = createAuthStore({ baseUrl: API_URL, scope: 'admin' });

export const {
  emitAuthChanged,
  loadAuth,
  storeAuth,
  updateStoredAuthUser,
  clearAuth,
  setAccessToken,
  getAccessToken,
  getCsrfToken,
  isAuthenticated,
  isAdminAuthenticated,
} = authStore;

export const bootstrapAdminAuthSession = authStore.bootstrapSession;

export const hasAdminPermission = (
  scope: AdminPermissionScope,
  level: AdminPermissionLevel,
): boolean => authStore.hasAdminPermission(scope, level);

export { getInitials };
