import {
  applyThemeClass,
  createApiClient,
  emitThemeChanged,
  loadAnonymousPreferences,
  resolveIsDark,
  saveAnonymousPreferences,
  toApiError,
} from '@synqit/client';

import { authStore } from './auth';
import { API_URL } from './constants';

const client = createApiClient({
  baseUrl: API_URL,
  auth: authStore,
  loginPath: '/auth/login',
  isOnLoginPage: (pathname) => pathname.startsWith('/auth/'),
  getLocale: () => loadAnonymousPreferences().locale,
  // A refresh returns the user's saved preferences; apply them so a fresh tab
  // matches the account without an extra round trip.
  onRefreshed: ({ snapshot }) => {
    if (!snapshot) {
      return;
    }
    authStore.updateStoredAuthUser({ avatarUrl: snapshot.avatarUrl });
    if (snapshot.theme) {
      saveAnonymousPreferences({ theme: snapshot.theme });
      applyThemeClass(resolveIsDark(snapshot.theme));
      emitThemeChanged();
    }
    if (snapshot.locale) {
      saveAnonymousPreferences({ locale: snapshot.locale });
    }
  },
});

export const callApi = client.callApi;
export { toApiError };
