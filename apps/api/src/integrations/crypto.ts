import { readRequiredEnv } from '@synqit/shared';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

type EncryptedToken = {
  iv: string;
  ciphertext: string;
  authTag: string;
};

const ALGORITHM = 'aes-256-gcm';
const IV_BYTE_LENGTH = 12;

const deriveKey = (secret: string): Buffer => createHash('sha256').update(secret, 'utf8').digest();

// No fallback: startup validation in config.ts guarantees TOKEN_ENC_KEY exists.
const getTokenEncryptionKey = (): Buffer =>
  deriveKey(readRequiredEnv(process.env, 'TOKEN_ENC_KEY'));

// Key rotation: set TOKEN_ENC_KEY to the new value and TOKEN_ENC_KEY_PREVIOUS to the
// old one. New writes use the new key; reads fall back to the previous key, and
// tokens are re-encrypted with the new key the next time the provider refreshes
// them. Drop TOKEN_ENC_KEY_PREVIOUS once all integrations have cycled.
const getPreviousTokenEncryptionKey = (): Buffer | null => {
  const previous = process.env.TOKEN_ENC_KEY_PREVIOUS?.trim();
  return previous ? deriveKey(previous) : null;
};

const decryptWithKey = (encryptedToken: EncryptedToken, key: Buffer): string => {
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(encryptedToken.iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(encryptedToken.authTag, 'base64url'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedToken.ciphertext, 'base64url')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
};

export const encryptToken = (value: string): EncryptedToken => {
  const key = getTokenEncryptionKey();
  const iv = randomBytes(IV_BYTE_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('base64url'),
    ciphertext: encrypted.toString('base64url'),
    authTag: authTag.toString('base64url'),
  };
};

export const decryptToken = (encryptedToken: EncryptedToken): string => {
  try {
    return decryptWithKey(encryptedToken, getTokenEncryptionKey());
  } catch (error) {
    const previousKey = getPreviousTokenEncryptionKey();
    if (!previousKey) {
      throw error;
    }

    return decryptWithKey(encryptedToken, previousKey);
  }
};

export type { EncryptedToken };
