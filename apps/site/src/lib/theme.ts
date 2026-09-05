import { createLocalThemeStore, type BinaryTheme } from '@synqit/client';

export type SiteTheme = BinaryTheme;

const store = createLocalThemeStore('synqit.site.theme.v1');

export const loadTheme = store.load;
export const applyTheme = store.apply;
export const persistTheme = store.persist;
