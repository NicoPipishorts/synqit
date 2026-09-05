import { createApiClient, loadAnonymousPreferences, toApiError } from '@synqit/client';

import { authStore } from './auth';
import { API_URL } from './constants';

const client = createApiClient({
  baseUrl: API_URL,
  auth: authStore,
  loginPath: '/login',
  getLocale: () => loadAnonymousPreferences().locale,
});

export const callApi = client.callApi;
export { toApiError };
