/** Picks the first supported locale matching the browser language, else the default. */
export const detectBrowserLocale = <L extends string>(supported: readonly L[], fallback: L): L => {
  if (typeof navigator === 'undefined' || !navigator.language) {
    return fallback;
  }

  const language = navigator.language.toLowerCase();
  return supported.find((locale) => language.startsWith(locale.toLowerCase())) ?? fallback;
};

/** Reads `?<param>=<locale>` from the current URL when it names a supported locale. */
export const readLocaleFromQuery = <L extends string>(
  supported: readonly L[],
  param = 'lang',
): L | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const value = new URLSearchParams(window.location.search).get(param);
  return (supported as readonly string[]).includes(value ?? '') ? (value as L) : null;
};

export const isSupportedLocale = <L extends string>(
  supported: readonly L[],
  value: unknown,
): value is L => typeof value === 'string' && (supported as readonly string[]).includes(value);
