// localStorage keys and window events shared by the web and admin apps. The two
// apps run on different origins, so identical keys never collide.
export const AUTH_STORAGE_KEY = 'synqit.auth.v1';
export const AUTH_CHANGED_EVENT = 'synqit:auth-changed';
export const THEME_STORAGE_KEY = 'synqit.theme.v1';
export const THEME_CHANGED_EVENT = 'synqit:theme-changed';
export const LOCALE_STORAGE_KEY = 'synqit.locale.v1';
export const PREFERENCES_STORAGE_KEY = 'synqit.preferences.v1';
export const PROFILE_SETTINGS_STORAGE_KEY = 'synqit.profile-settings.v1';
export const PROFILE_SETTINGS_CHANGED_EVENT = 'synqit:profile-settings-changed';
export const ANALYTICS_SESSION_STORAGE_KEY = 'synqit.analytics.session.v1';

export const CSRF_HEADER_NAME = 'x-synqit-csrf-token';
export const LOCALE_HEADER_NAME = 'x-synqit-locale';
