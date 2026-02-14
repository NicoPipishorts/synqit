import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, extname, resolve, sep } from 'node:path';

const DEFAULT_API_BASE_URL = 'http://localhost:3001';
const DEFAULT_AVATAR_STORAGE_DIR = resolve(process.cwd(), 'data', 'uploads', 'avatars');
const DEFAULT_AVATAR_MAX_BYTES = 1_500_000;

const AVATAR_PUBLIC_ROUTE_PREFIX = '/v1/public/avatars';

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

const avatarStorageDir = process.env.AVATAR_STORAGE_DIR
  ? resolve(process.env.AVATAR_STORAGE_DIR)
  : DEFAULT_AVATAR_STORAGE_DIR;

const parsePositiveInteger = (raw: string | undefined, fallback: number): number => {
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
};

const avatarMaxBytes = parsePositiveInteger(process.env.AVATAR_MAX_BYTES, DEFAULT_AVATAR_MAX_BYTES);

const normalizeBaseUrl = (value: string): string => {
  return value.endsWith('/') ? value.slice(0, -1) : value;
};

const getApiBaseUrl = (): string => {
  return normalizeBaseUrl(process.env.API_BASE_URL ?? DEFAULT_API_BASE_URL);
};

const toSafeFileSegment = (value: string): string => {
  const normalized = value.replace(/[^a-zA-Z0-9_-]/g, '');
  return normalized.length > 0 ? normalized.slice(0, 24) : 'user';
};

const toAvatarFilePath = (fileName: string): string => {
  return resolve(avatarStorageDir, fileName);
};

const isInsideAvatarStorageDir = (filePath: string): boolean => {
  const normalizedStorage = `${avatarStorageDir}${sep}`;
  return filePath === avatarStorageDir || filePath.startsWith(normalizedStorage);
};

const parseImageDataUrl = (
  imageDataUrl: string,
): { buffer: Buffer; mimeType: string; extension: string } | null => {
  const trimmed = imageDataUrl.trim();
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(trimmed);
  if (!match) {
    return null;
  }

  const mimeType = match[1].toLowerCase();
  const extension = ALLOWED_MIME_TO_EXT[mimeType];
  if (!extension) {
    return null;
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.byteLength === 0 || buffer.byteLength > avatarMaxBytes) {
    return null;
  }

  return {
    buffer,
    mimeType,
    extension,
  };
};

export const buildAvatarUrl = (avatarPath: string | null | undefined): string | null => {
  if (!avatarPath) {
    return null;
  }

  return `${getApiBaseUrl()}${avatarPath}`;
};

export const getAvatarStorageDir = (): string => avatarStorageDir;

export const getAvatarPublicPath = (fileName: string): string => {
  return `${AVATAR_PUBLIC_ROUTE_PREFIX}/${fileName}`;
};

export const saveAvatarImage = async (params: {
  userId: string;
  imageDataUrl: string;
}): Promise<{ avatarPath: string }> => {
  const parsed = parseImageDataUrl(params.imageDataUrl);
  if (!parsed) {
    throw new Error('invalid_avatar_image');
  }

  await mkdir(avatarStorageDir, { recursive: true });

  const fileName = `${toSafeFileSegment(params.userId)}-${Date.now()}-${randomUUID().slice(0, 8)}.${parsed.extension}`;
  const filePath = toAvatarFilePath(fileName);
  await writeFile(filePath, parsed.buffer);

  return {
    avatarPath: getAvatarPublicPath(fileName),
  };
};

export const deleteAvatarImage = async (avatarPath: string): Promise<void> => {
  const prefix = `${AVATAR_PUBLIC_ROUTE_PREFIX}/`;
  if (!avatarPath.startsWith(prefix)) {
    return;
  }

  const fileName = basename(avatarPath.slice(prefix.length));
  if (!fileName) {
    return;
  }

  const filePath = toAvatarFilePath(fileName);
  if (!isInsideAvatarStorageDir(filePath)) {
    return;
  }

  try {
    await unlink(filePath);
  } catch (error) {
    const normalizedError = error as { code?: string };
    if (normalizedError.code !== 'ENOENT') {
      throw error;
    }
  }
};

export const resolveAvatarFile = async (
  fileNameParam: string,
): Promise<{ filePath: string; contentType: string } | null> => {
  const fileName = basename(fileNameParam);
  if (fileName !== fileNameParam || fileName.length === 0) {
    return null;
  }

  const extension = extname(fileName).toLowerCase();
  const contentType = EXT_TO_MIME[extension];
  if (!contentType) {
    return null;
  }

  const filePath = toAvatarFilePath(fileName);
  if (!isInsideAvatarStorageDir(filePath)) {
    return null;
  }

  try {
    await access(filePath);
  } catch {
    return null;
  }

  return {
    filePath,
    contentType,
  };
};

export const createAvatarReadStream = (filePath: string) => {
  return createReadStream(filePath);
};
