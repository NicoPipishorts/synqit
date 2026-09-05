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
  /** Non-fatal findings to log once the server logger exists. */
  warnings: string[];
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

  return {
    strictSecrets,
    jwtAccessSecret: jwtAccessSecret.value,
    tokenEncryptionKey: tokenEncryptionKey.value,
    databaseUrl,
    metricsToken,
    docsEnabled,
    warnings,
  };
};
