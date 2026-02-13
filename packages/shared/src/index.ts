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

export const eventStatusSchema = z.enum(['open', 'closed']);
export type EventStatus = z.infer<typeof eventStatusSchema>;

export const createEventRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().default(''),
});
export type CreateEventRequest = z.infer<typeof createEventRequestSchema>;

export const updateEventRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().default(''),
});
export type UpdateEventRequest = z.infer<typeof updateEventRequestSchema>;

export const eventSchema = z.object({
  id: z.string(),
  hostUserId: z.string(),
  provider: providerSchema,
  providerPlaylistId: z.string(),
  status: eventStatusSchema,
  name: z.string(),
  description: z.string(),
  magicLinkToken: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  closedAt: z.string().nullable(),
});
export type Event = z.infer<typeof eventSchema>;

export const eventResponseSchema = z.object({
  event: eventSchema,
  magicLinkUrl: z.string().url(),
});
export type EventResponse = z.infer<typeof eventResponseSchema>;

export const eventListResponseSchema = z.object({
  events: z.array(eventSchema),
});
export type EventListResponse = z.infer<typeof eventListResponseSchema>;

export const eventPublicSchema = z.object({
  id: z.string(),
  provider: providerSchema,
  status: eventStatusSchema,
  name: z.string(),
  description: z.string(),
  createdAt: z.string(),
});
export type EventPublic = z.infer<typeof eventPublicSchema>;

export const eventPublicResponseSchema = z.object({
  event: eventPublicSchema,
});
export type EventPublicResponse = z.infer<typeof eventPublicResponseSchema>;

export const eventTrackSchema = z.object({
  providerTrackId: z.string(),
  name: z.string(),
  artist: z.string(),
  album: z.string(),
  durationMs: z.number().int().nonnegative(),
  artworkUrl: z.string().url().nullable(),
  addedAt: z.string(),
  addedBy: z.string(),
});
export type EventTrack = z.infer<typeof eventTrackSchema>;

export const eventTracksResponseSchema = z.object({
  tracks: z.array(eventTrackSchema),
});
export type EventTracksResponse = z.infer<typeof eventTracksResponseSchema>;

export const eventTrackSearchResultSchema = z.object({
  providerTrackId: z.string(),
  name: z.string(),
  artist: z.string(),
  album: z.string(),
  durationMs: z.number().int().nonnegative(),
  artworkUrl: z.string().url().nullable(),
});
export type EventTrackSearchResult = z.infer<typeof eventTrackSearchResultSchema>;

export const eventTrackSearchResponseSchema = z.object({
  results: z.array(eventTrackSearchResultSchema),
});
export type EventTrackSearchResponse = z.infer<typeof eventTrackSearchResponseSchema>;

export const addEventTrackRequestSchema = z.object({
  providerTrackId: z.string().min(1),
  name: z.string().min(1),
  artist: z.string().min(1),
  album: z.string().min(1),
  durationMs: z.number().int().nonnegative(),
  artworkUrl: z.string().url().nullable().optional().default(null),
});
export type AddEventTrackRequest = z.infer<typeof addEventTrackRequestSchema>;

export const addEventTrackResponseSchema = z.object({
  ok: z.literal(true),
  track: eventTrackSchema,
});
export type AddEventTrackResponse = z.infer<typeof addEventTrackResponseSchema>;

export const deleteEventResponseSchema = z.object({
  ok: z.literal(true),
  deleted: z.literal(true),
  eventId: z.string(),
});
export type DeleteEventResponse = z.infer<typeof deleteEventResponseSchema>;

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
