import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

type EncryptedToken = {
  iv: string;
  ciphertext: string;
  authTag: string;
};

const ALGORITHM = 'aes-256-gcm';
const IV_BYTE_LENGTH = 12;

const getTokenEncryptionKey = (): Buffer => {
  const secret = process.env.TOKEN_ENC_KEY ?? 'replace-me';
  return createHash('sha256').update(secret, 'utf8').digest();
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
  const key = getTokenEncryptionKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(encryptedToken.iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(encryptedToken.authTag, 'base64url'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedToken.ciphertext, 'base64url')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
};

export type { EncryptedToken };
