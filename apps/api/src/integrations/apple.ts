const DEFAULT_APPLE_STOREFRONT = 'us';
const APPLE_DEVELOPER_TOKEN_TTL_SECONDS = 60 * 60;

type SignJwtBuilder = {
  setProtectedHeader(header: { alg: string; kid: string; typ: string }): SignJwtBuilder;
  setIssuer(issuer: string): SignJwtBuilder;
  setIssuedAt(issuedAt: number): SignJwtBuilder;
  setExpirationTime(expirationTime: number): SignJwtBuilder;
  sign(key: unknown): Promise<string>;
};

type JoseModule = {
  SignJWT: new (payload: Record<string, never>) => SignJwtBuilder;
  importPKCS8: (pkcs8: string, alg: string) => Promise<unknown>;
};

const isUnset = (value: string | undefined): boolean =>
  !value || value.trim() === '' || value.trim() === 'replace-me';

const getAppleTeamId = (): string => process.env.APPLE_TEAM_ID ?? '';
const getAppleKeyId = (): string => process.env.APPLE_KEY_ID ?? '';
const getAppleMusicKitIdentifier = (): string => process.env.APPLE_MUSICKIT_IDENTIFIER ?? '';
const getApplePrivateKey = (): string => process.env.APPLE_PRIVATE_KEY_P8 ?? '';

export const getAppleStorefront = (): string =>
  (process.env.APPLE_STOREFRONT ?? DEFAULT_APPLE_STOREFRONT).trim().toLowerCase();

export const isAppleLiveMode = (): boolean =>
  !isUnset(getAppleTeamId()) &&
  !isUnset(getAppleKeyId()) &&
  !isUnset(getAppleMusicKitIdentifier()) &&
  !isUnset(getApplePrivateKey());

export const getAppleMusicKitIdentifierForClient = (): string => getAppleMusicKitIdentifier();

let cachedDeveloperToken: { token: string; expiresAtEpochSeconds: number } | null = null;
let joseModulePromise: Promise<JoseModule> | null = null;

const loadJose = async (): Promise<JoseModule> => {
  if (!joseModulePromise) {
    joseModulePromise = import('jose');
  }
  return joseModulePromise;
};

const parsePrivateKeyPem = (): string => {
  const privateKey = getApplePrivateKey();
  if (isUnset(privateKey)) {
    throw new Error('Apple private key is not configured.');
  }

  const normalized = privateKey.trim().replace(/^"|"$/g, '').replace(/\\n/g, '\n');
  if (!normalized.includes('BEGIN PRIVATE KEY')) {
    throw new Error('Apple private key format is invalid.');
  }

  return normalized;
};

export const getAppleDeveloperToken = async (params?: {
  forceRefresh?: boolean;
}): Promise<string> => {
  if (!isAppleLiveMode()) {
    throw new Error(
      'Apple Music auth is not configured. Set APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_MUSICKIT_IDENTIFIER, and APPLE_PRIVATE_KEY_P8.',
    );
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    !params?.forceRefresh &&
    cachedDeveloperToken &&
    cachedDeveloperToken.expiresAtEpochSeconds - 60 > now &&
    cachedDeveloperToken.token
  ) {
    return cachedDeveloperToken.token;
  }

  const teamId = getAppleTeamId();
  const keyId = getAppleKeyId();
  const privateKey = parsePrivateKeyPem();
  const { SignJWT, importPKCS8 } = await loadJose();
  const key = await importPKCS8(privateKey, 'ES256');

  const expiresAtEpochSeconds = now + APPLE_DEVELOPER_TOKEN_TTL_SECONDS;
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId, typ: 'JWT' })
    .setIssuer(teamId)
    .setIssuedAt(now)
    .setExpirationTime(expiresAtEpochSeconds)
    .sign(key);

  cachedDeveloperToken = {
    token,
    expiresAtEpochSeconds,
  };

  return token;
};
