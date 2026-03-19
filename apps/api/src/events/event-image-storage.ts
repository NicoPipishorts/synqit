import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, extname, resolve, sep } from 'node:path';

const DEFAULT_API_BASE_URL = 'http://localhost:3001';
const DEFAULT_EVENT_IMAGE_STORAGE_DIR = resolve(process.cwd(), 'data', 'uploads', 'event-images');
const DEFAULT_EVENT_IMAGE_MAX_BYTES = 8_000_000;

const EVENT_IMAGE_PUBLIC_ROUTE_PREFIX = '/v1/public/event-images';

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

const eventImageStorageDir = process.env.EVENT_IMAGE_STORAGE_DIR
  ? resolve(process.env.EVENT_IMAGE_STORAGE_DIR)
  : DEFAULT_EVENT_IMAGE_STORAGE_DIR;

const parsePositiveInteger = (raw: string | undefined, fallback: number): number => {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const eventImageMaxBytes = parsePositiveInteger(
  process.env.EVENT_IMAGE_MAX_BYTES,
  DEFAULT_EVENT_IMAGE_MAX_BYTES,
);

const normalizeBaseUrl = (value: string): string =>
  value.endsWith('/') ? value.slice(0, -1) : value;

const getApiBaseUrl = (): string =>
  normalizeBaseUrl(process.env.API_BASE_URL ?? DEFAULT_API_BASE_URL);

const toSafeFileSegment = (value: string): string => {
  const normalized = value.replace(/[^a-zA-Z0-9_-]/g, '');
  return normalized.length > 0 ? normalized.slice(0, 24) : 'event';
};

const toEventImageFilePath = (fileName: string): string => resolve(eventImageStorageDir, fileName);

const isInsideEventImageStorageDir = (filePath: string): boolean => {
  const normalizedStorage = `${eventImageStorageDir}${sep}`;
  return filePath === eventImageStorageDir || filePath.startsWith(normalizedStorage);
};

const parseImageDataUrl = (
  imageDataUrl: string,
): { buffer: Buffer; mimeType: string; extension: string } | null => {
  const trimmed = imageDataUrl.trim();
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(trimmed);
  if (!match) return null;

  const mimeType = match[1].toLowerCase();
  const extension = ALLOWED_MIME_TO_EXT[mimeType];
  if (!extension) return null;

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.byteLength === 0 || buffer.byteLength > eventImageMaxBytes) return null;

  return { buffer, mimeType, extension };
};

export const buildEventImageUrl = (imagePath: string | null | undefined): string | null => {
  if (!imagePath) return null;
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  if (imagePath.startsWith('/')) return `${getApiBaseUrl()}${imagePath}`;
  return `${getApiBaseUrl()}/${imagePath}`;
};

export const getEventImagePublicPath = (fileName: string): string =>
  `${EVENT_IMAGE_PUBLIC_ROUTE_PREFIX}/${fileName}`;

export const saveEventImage = async (params: {
  eventId: string;
  imageDataUrl: string;
}): Promise<{ imagePath: string }> => {
  const parsed = parseImageDataUrl(params.imageDataUrl);
  if (!parsed) throw new Error('invalid_event_image');

  await mkdir(eventImageStorageDir, { recursive: true });

  const fileName = `${toSafeFileSegment(params.eventId)}-${Date.now()}-${randomUUID().slice(0, 8)}.${parsed.extension}`;
  const filePath = toEventImageFilePath(fileName);
  await writeFile(filePath, parsed.buffer);

  return { imagePath: getEventImagePublicPath(fileName) };
};

export const deleteEventImage = async (imagePath: string): Promise<void> => {
  const prefix = `${EVENT_IMAGE_PUBLIC_ROUTE_PREFIX}/`;
  if (!imagePath.startsWith(prefix)) return;

  const fileName = basename(imagePath.slice(prefix.length));
  if (!fileName) return;

  const filePath = toEventImageFilePath(fileName);
  if (!isInsideEventImageStorageDir(filePath)) return;

  try {
    await unlink(filePath);
  } catch (error) {
    const normalizedError = error as { code?: string };
    if (normalizedError.code !== 'ENOENT') throw error;
  }
};

export const resolveEventImageFile = async (
  fileNameParam: string,
): Promise<{ filePath: string; contentType: string } | null> => {
  const fileName = basename(fileNameParam);
  if (fileName !== fileNameParam || fileName.length === 0) return null;

  const extension = extname(fileName).toLowerCase();
  const contentType = EXT_TO_MIME[extension];
  if (!contentType) return null;

  const filePath = toEventImageFilePath(fileName);
  if (!isInsideEventImageStorageDir(filePath)) return null;

  try {
    await access(filePath);
  } catch {
    return null;
  }

  return { filePath, contentType };
};

export const createEventImageReadStream = (filePath: string) => createReadStream(filePath);
