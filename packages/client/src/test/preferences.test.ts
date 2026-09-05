import { PREFERENCES_STORAGE_KEY, THEME_STORAGE_KEY } from '../constants';
import { loadAnonymousPreferences, saveAnonymousPreferences } from '../preferences';
import { createLocalThemeStore, resolveIsDark } from '../theme';

describe('preferences', () => {
  beforeEach(() => localStorage.clear());

  it('migrates legacy keys and sanitises values', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(loadAnonymousPreferences()).toEqual({ theme: 'dark', locale: undefined });
    expect(JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? '{}')).toEqual({
      theme: 'dark',
    });

    saveAnonymousPreferences({ locale: 'fr' });
    expect(loadAnonymousPreferences()).toEqual({ theme: 'dark', locale: 'fr' });

    // Invalid values are dropped on write.
    localStorage.removeItem(THEME_STORAGE_KEY);
    saveAnonymousPreferences({ theme: 'purple' as never });
    expect(loadAnonymousPreferences()).toEqual({ theme: undefined, locale: 'fr' });
  });
});

describe('theme helpers', () => {
  it('resolves explicit themes without consulting the OS', () => {
    expect(resolveIsDark('dark')).toBe(true);
    expect(resolveIsDark('light')).toBe(false);
  });

  it('local theme store round-trips and toggles the dark class', () => {
    const store = createLocalThemeStore('site.theme');
    store.persist('dark');
    expect(store.load()).toBe('dark');
    store.apply('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    store.apply('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
