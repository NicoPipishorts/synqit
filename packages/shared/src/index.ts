import { z } from 'zod';

export const providerSchema = z.enum(['spotify']);
export type Provider = z.infer<typeof providerSchema>;

export const authCredentialsSchema = z.object({
  email: z
    .string()
    .email()
    .max(320)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
});

export type AuthCredentials = z.infer<typeof authCredentialsSchema>;

export const refreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(20),
});

export type RefreshTokenRequest = z.infer<typeof refreshTokenRequestSchema>;

export const authUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  createdAt: z.string(),
});

export type AuthUser = z.infer<typeof authUserSchema>;

export const authTokenSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  tokenType: z.literal('Bearer'),
  expiresInSeconds: z.number().int().positive(),
});

export type AuthToken = z.infer<typeof authTokenSchema>;

export const authResponseSchema = z.object({
  user: authUserSchema,
  tokens: authTokenSchema,
});

export type AuthResponse = z.infer<typeof authResponseSchema>;

export const refreshResponseSchema = z.object({
  tokens: authTokenSchema,
});

export type RefreshResponse = z.infer<typeof refreshResponseSchema>;

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
