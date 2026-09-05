/**
 * Environment validation helpers shared by the API and worker.
 *
 * Pure functions only: callers pass the env source (normally `process.env`) so
 * this module stays browser-safe for the web bundles that import `@synqit/shared`.
 */

export type EnvSource = Record<string, string | undefined>;

export class EnvValidationError extends Error {
  readonly variable: string;

  constructor(variable: string, message: string) {
    super(message);
    this.name = 'EnvValidationError';
    this.variable = variable;
  }
}

export const DEFAULT_MIN_SECRET_LENGTH = 32;

/** Values that ship in `.env.example` files or old code fallbacks and must never run in production. */
export const PLACEHOLDER_SECRET_VALUES = [
  'replace-me',
  'replace_me',
  'replaceme',
  'change-me',
  'change_me',
  'changeme',
  'secret',
  'password',
  'dev-access-secret',
  'dev-refresh-secret',
  'test',
  'example',
  'todo',
] as const;

export const SECRET_GENERATION_HINT = 'Generate one with: openssl rand -base64 48';

export const parseBooleanEnv = (raw: string | undefined, fallback: boolean): boolean => {
  if (raw === undefined) {
    return fallback;
  }

  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
};

/**
 * Strict mode is where weak or placeholder secrets are fatal. It is on in
 * production and can be forced elsewhere with `SECRETS_STRICT=true`.
 */
export const isStrictSecretsMode = (env: EnvSource): boolean =>
  env.NODE_ENV?.trim().toLowerCase() === 'production' || parseBooleanEnv(env.SECRETS_STRICT, false);

export const isPlaceholderSecret = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    return true;
  }

  if ((PLACEHOLDER_SECRET_VALUES as readonly string[]).includes(normalized)) {
    return true;
  }

  // "replace-this-key", "your-very-long-random-key", "change me now", ...
  if (/^(replace|change|your|todo|insert|put)[-_ ]/.test(normalized)) {
    return true;
  }

  // A single repeated character is not a secret.
  return /^(.)\1*$/.test(normalized);
};

/** Returns a human-readable reason the secret is weak, or null when it is acceptable. */
export const describeSecretWeakness = (
  value: string,
  minLength = DEFAULT_MIN_SECRET_LENGTH,
): string | null => {
  if (isPlaceholderSecret(value)) {
    return 'a placeholder value';
  }

  if (value.trim().length < minLength) {
    return `too short (${value.trim().length} chars, minimum ${minLength})`;
  }

  return null;
};

export const readOptionalEnv = (env: EnvSource, name: string): string | null => {
  const value = env[name]?.trim();
  return value ? value : null;
};

export const readRequiredEnv = (env: EnvSource, name: string): string => {
  const value = readOptionalEnv(env, name);
  if (!value) {
    throw new EnvValidationError(name, `${name} is required but not set.`);
  }

  return value;
};

export type SecretEnvResult = {
  value: string;
  /** Non-null when the secret is weak but tolerated because strict mode is off. */
  warning: string | null;
};

/**
 * Reads a secret that must always be present. Weak or placeholder values throw
 * in strict mode and produce a warning otherwise.
 */
export const readSecretEnv = (
  env: EnvSource,
  name: string,
  options: { strict: boolean; minLength?: number },
): SecretEnvResult => {
  const value = readRequiredEnv(env, name);
  const weakness = describeSecretWeakness(value, options.minLength ?? DEFAULT_MIN_SECRET_LENGTH);
  if (!weakness) {
    return { value, warning: null };
  }

  if (options.strict) {
    throw new EnvValidationError(
      name,
      `${name} is ${weakness}; refusing to start in strict mode. ${SECRET_GENERATION_HINT}`,
    );
  }

  return {
    value,
    warning: `${name} is ${weakness}. Tolerated outside production, but startup will fail with NODE_ENV=production. ${SECRET_GENERATION_HINT}`,
  };
};
