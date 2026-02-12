import { z } from 'zod';

export const providerSchema = z.enum(['spotify']);
export type Provider = z.infer<typeof providerSchema>;

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  timestamp: z.string(),
});

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export const QUEUES = {
  sync: 'sync',
} as const;

export const JOBS = {
  pullPlaylists: 'sync:pullPlaylists',
} as const;
