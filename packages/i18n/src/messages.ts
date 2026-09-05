export type MessageDictionary = Record<string, unknown>;
export type MessageVars = Record<string, string | number>;

/** Reads a dotted path (`"auth.login.title"`) out of a nested dictionary. */
export const resolvePath = (dictionary: unknown, path: string): string | null => {
  if (!dictionary || typeof dictionary !== 'object') {
    return null;
  }

  const value = path.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') {
      return null;
    }
    return (current as Record<string, unknown>)[segment];
  }, dictionary);

  return typeof value === 'string' ? value : null;
};

/** Replaces `{{name}}` placeholders. Unknown placeholders are left untouched. */
export const interpolate = (template: string, vars?: MessageVars): string => {
  if (!vars) {
    return template;
  }

  return Object.entries(vars).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, String(value)),
    template,
  );
};

/**
 * Looks a key up with plural support: when `vars.count` is a number, `key_one`
 * (count === 1) or `key_other` is tried first, then the bare key.
 */
export const lookupMessage = (
  dictionary: MessageDictionary | null,
  key: string,
  vars?: MessageVars,
): string | null => {
  if (!dictionary) {
    return null;
  }

  if (typeof vars?.count === 'number') {
    const plural = resolvePath(dictionary, `${key}_${vars.count === 1 ? 'one' : 'other'}`);
    if (plural) {
      return plural;
    }
  }

  return resolvePath(dictionary, key);
};

/**
 * Translates with fallback: active dictionary, then fallback dictionary, then
 * the key itself so missing copy is visible instead of blank.
 */
export const translate = (
  active: MessageDictionary | null,
  fallback: MessageDictionary | null,
  key: string,
  vars?: MessageVars,
): string => {
  const message = lookupMessage(active, key, vars) ?? lookupMessage(fallback, key, vars);
  return message ? interpolate(message, vars) : key;
};
