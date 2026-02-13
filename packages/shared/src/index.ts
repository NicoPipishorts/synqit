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

export const providerConnectionStatusSchema = z.enum(['connected', 'not_connected']);
export type ProviderConnectionStatus = z.infer<typeof providerConnectionStatusSchema>;

export const integrationStatusSchema = z.object({
  provider: providerSchema,
  status: providerConnectionStatusSchema,
  connectedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
});

export type IntegrationStatus = z.infer<typeof integrationStatusSchema>;

export const integrationListResponseSchema = z.object({
  integrations: z.array(integrationStatusSchema),
});

export type IntegrationListResponse = z.infer<typeof integrationListResponseSchema>;

export const oauthStartResponseSchema = z.object({
  provider: providerSchema,
  state: z.string(),
  authorizationUrl: z.string().url(),
});

export type OauthStartResponse = z.infer<typeof oauthStartResponseSchema>;

export const oauthCallbackQuerySchema = z.object({
  state: z.string().min(10),
  code: z.string().min(1),
  response_mode: z.enum(['json', 'redirect']).optional(),
});

export type OauthCallbackQuery = z.infer<typeof oauthCallbackQuerySchema>;

export const oauthCallbackResponseSchema = z.object({
  ok: z.literal(true),
  provider: providerSchema,
  connectedAt: z.string(),
  expiresAt: z.string().nullable(),
});

export type OauthCallbackResponse = z.infer<typeof oauthCallbackResponseSchema>;

export const integrationDisconnectResponseSchema = z.object({
  ok: z.literal(true),
  provider: providerSchema,
  disconnected: z.boolean(),
});

export type IntegrationDisconnectResponse = z.infer<typeof integrationDisconnectResponseSchema>;

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
