import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

const PASSWORD_HASH_PREFIX = 'scrypt';

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${PASSWORD_HASH_PREFIX}$${salt}$${derived.toString('hex')}`;
};

export const verifyPassword = async (password: string, storedHash: string): Promise<boolean> => {
  const [prefix, salt, hashHex] = storedHash.split('$');
  if (prefix !== PASSWORD_HASH_PREFIX || !salt || !hashHex) {
    return false;
  }

  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const hashBuffer = Buffer.from(hashHex, 'hex');

  if (derived.length !== hashBuffer.length) {
    return false;
  }

  return timingSafeEqual(derived, hashBuffer);
};

export const createOpaqueToken = (): string => randomBytes(48).toString('base64url');

export const createRefreshToken = (): string => createOpaqueToken();

export const hashToken = (token: string): string =>
  createHash('sha256').update(token, 'utf8').digest('hex');
