import {
  DEFAULT_MIN_SECRET_LENGTH,
  EnvValidationError,
  SECRET_GENERATION_HINT,
  describeSecretWeakness,
  isStrictSecretsMode,
  parseBooleanEnv,
  readOptionalEnv,
  readRequiredEnv,
  readSecretEnv,
  type EnvSource,
} from '@synqit/shared';

export type ApiConfig = {
  /** Production, or `SECRETS_STRICT=true`: weak secrets are fatal and internal endpoints need auth. */
  strictSecrets: boolean;
  jwtAccessSecret: string;
  tokenEncryptionKey: string;
  databaseUrl: string;
  /** Bearer token required to read `/metrics`. Null disables the endpoint in strict mode. */
  metricsToken: string | null;
  /** Whether Swagger UI is mounted at `/docs`. Defaults to off in strict mode. */
  docsEnabled: boolean;
  /** Lower-cased full email addresses granted super admin permissions. */
  superAdminEmails: string[];
  /** Non-fatal findings to log once the server logger exists. */
  warnings: string[];
};

const parseSuperAdminEmails = (raw: string | undefined): { valid: string[]; invalid: string[] } => {
  const entries = (raw ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return {
    valid: entries.filter((entry) => entry.includes('@')),
    invalid: entries.filter((entry) => !entry.includes('@')),
  };
};

/**
 * Validates every secret the API needs before anything binds a port.
 *
 * Throws `EnvValidationError` when a required value is missing, or when a value
 * is weak while strict mode is on. Never falls back to a hard-coded credential.
 */
export const loadApiConfig = (env: EnvSource = process.env): ApiConfig => {
  const strictSecrets = isStrictSecretsMode(env);
  const warnings: string[] = [];

  const jwtAccessSecret = readSecretEnv(env, 'JWT_ACCESS_SECRET', { strict: strictSecrets });
  const tokenEncryptionKey = readSecretEnv(env, 'TOKEN_ENC_KEY', { strict: strictSecrets });
  for (const result of [jwtAccessSecret, tokenEncryptionKey]) {
    if (result.warning) {
      warnings.push(result.warning);
    }
  }

  const databaseUrl = readRequiredEnv(env, 'DATABASE_URL');

  const metricsToken = readOptionalEnv(env, 'METRICS_TOKEN');
  if (metricsToken) {
    const weakness = describeSecretWeakness(metricsToken, DEFAULT_MIN_SECRET_LENGTH);
    if (weakness && strictSecrets) {
      throw new EnvValidationError(
        'METRICS_TOKEN',
        `METRICS_TOKEN is ${weakness}; refusing to start in strict mode. ${SECRET_GENERATION_HINT}`,
      );
    }
    if (weakness) {
      warnings.push(`METRICS_TOKEN is ${weakness}. ${SECRET_GENERATION_HINT}`);
    }
  } else if (strictSecrets) {
    warnings.push('METRICS_TOKEN is not set; /metrics is disabled until it is configured.');
  }

  const docsEnabled = parseBooleanEnv(env.API_DOCS_ENABLED, !strictSecrets);

  // Super admins are identified by full email only. Production must set the list
  // explicitly instead of relying on the development default.
  const superAdmins = parseSuperAdminEmails(env.ADMIN_SUPER_USERS);
  if (superAdmins.invalid.length > 0) {
    const message = `ADMIN_SUPER_USERS entries must be full email addresses; ignoring: ${superAdmins.invalid.join(', ')}`;
    if (strictSecrets) {
      throw new EnvValidationError('ADMIN_SUPER_USERS', message);
    }
    warnings.push(message);
  }
  if (superAdmins.valid.length === 0) {
    if (strictSecrets) {
      throw new EnvValidationError(
        'ADMIN_SUPER_USERS',
        'ADMIN_SUPER_USERS must list at least one full email address in production.',
      );
    }
    if (env.ADMIN_SUPER_USERS === undefined) {
      warnings.push('ADMIN_SUPER_USERS is not set; falling back to the development default.');
    }
  }

  return {
    strictSecrets,
    jwtAccessSecret: jwtAccessSecret.value,
    tokenEncryptionKey: tokenEncryptionKey.value,
    databaseUrl,
    metricsToken,
    docsEnabled,
    superAdminEmails: superAdmins.valid,
    warnings,
  };
};
