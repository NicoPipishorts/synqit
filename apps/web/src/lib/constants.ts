export {
  ANALYTICS_SESSION_STORAGE_KEY,
  AUTH_CHANGED_EVENT,
  AUTH_STORAGE_KEY,
  LOCALE_STORAGE_KEY,
  PREFERENCES_STORAGE_KEY,
  PROFILE_SETTINGS_CHANGED_EVENT,
  PROFILE_SETTINGS_STORAGE_KEY,
  THEME_CHANGED_EVENT,
  THEME_STORAGE_KEY,
} from '@synqit/client';

/** Same-origin `/api` proxy in dev and behind Caddy; overridable for other deployments. */
export const API_URL = import.meta.env.VITE_API_URL ?? '/api';
