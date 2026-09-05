import { createAuthStore, getInitials } from '@synqit/client';

import { API_URL } from './constants';

/** Web-scoped session store (cookie `synqit_web_csrf`, `/v1/me`, `/v1/auth/refresh`). */
export const authStore = createAuthStore({ baseUrl: API_URL, scope: 'web' });

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

export const bootstrapAuthSession = authStore.bootstrapSession;

export { getInitials };
