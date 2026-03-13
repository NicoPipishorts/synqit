import { z } from 'zod';

export const providerSchema = z.enum(['spotify', 'apple']);
export type Provider = z.infer<typeof providerSchema>;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

const passwordLowercasePattern = /[a-z]/;
const passwordUppercasePattern = /[A-Z]/;
const passwordNumberPattern = /\d/;
const passwordSpecialPattern = /[^A-Za-z0-9]/;

export type PasswordCriteria = {
  length: boolean;
  case: boolean;
  number: boolean;
  special: boolean;
};

export const getPasswordCriteria = (password: string): PasswordCriteria => ({
  length: password.length >= PASSWORD_MIN_LENGTH,
  case: passwordLowercasePattern.test(password) && passwordUppercasePattern.test(password),
  number: passwordNumberPattern.test(password),
  special: passwordSpecialPattern.test(password),
});

export const getPasswordStrengthScore = (password: string): number => {
  const criteria = getPasswordCriteria(password);
  return Object.values(criteria).filter(Boolean).length;
};

export const isPasswordStrong = (password: string): boolean => {
  const criteria = getPasswordCriteria(password);
  return criteria.length && criteria.case && criteria.number && criteria.special;
};

const authEmailSchema = z
  .string()
  .email()
  .max(320)
  .transform((value) => value.toLowerCase());

const authPasswordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);

export const strongPasswordSchema = authPasswordSchema.refine(isPasswordStrong, {
  message:
    'Password must include at least 8 characters, uppercase and lowercase letters, a number, and a special character.',
});

export const authCredentialsSchema = z.object({
  email: authEmailSchema,
  password: authPasswordSchema,
});

export type AuthCredentials = z.infer<typeof authCredentialsSchema>;

export const registerCredentialsSchema = z.object({
  email: authEmailSchema,
  password: strongPasswordSchema,
});

export type RegisterCredentials = z.infer<typeof registerCredentialsSchema>;

export const changePasswordRequestSchema = z.object({
  currentPassword: authPasswordSchema,
  newPassword: strongPasswordSchema,
});

export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

export const refreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(20),
});

export type RefreshTokenRequest = z.infer<typeof refreshTokenRequestSchema>;

export const forgotPasswordRequestSchema = z.object({
  email: authEmailSchema,
});
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>;

export const forgotPasswordResponseSchema = z.object({
  ok: z.literal(true),
});
export type ForgotPasswordResponse = z.infer<typeof forgotPasswordResponseSchema>;

export const resetPasswordRequestSchema = z.object({
  token: z.string().min(20).max(512),
  newPassword: strongPasswordSchema,
});
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;

export const resetPasswordResponseSchema = z.object({
  ok: z.literal(true),
});
export type ResetPasswordResponse = z.infer<typeof resetPasswordResponseSchema>;

export const accountRoleSchema = z.enum(['user', 'admin']);
export type AccountRole = z.infer<typeof accountRoleSchema>;

export const adminPermissionScopeSchema = z.enum([
  'dashboard',
  'users',
  'events',
  'integrations',
  'emails',
  'analytics',
]);
export type AdminPermissionScope = z.infer<typeof adminPermissionScopeSchema>;

export const adminPermissionLevelSchema = z.enum(['read', 'write']);
export type AdminPermissionLevel = z.infer<typeof adminPermissionLevelSchema>;

export const adminPermissionSchema = z.object({
  scope: adminPermissionScopeSchema,
  level: adminPermissionLevelSchema,
});
export type AdminPermission = z.infer<typeof adminPermissionSchema>;

export const authUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  createdAt: z.string(),
  avatarUrl: z.string().url().nullable().default(null),
  role: accountRoleSchema.default('user'),
  adminPermissions: z.array(adminPermissionSchema).default([]),
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
  snapshot: z
    .object({
      avatarUrl: z.string().url().nullable().default(null),
      theme: z.enum(['light', 'dark', 'auto']).nullable().optional(),
      locale: z.enum(['en', 'fr']).nullable().optional(),
    })
    .optional(),
});

export type RefreshResponse = z.infer<typeof refreshResponseSchema>;
export type RefreshSnapshot = NonNullable<RefreshResponse['snapshot']>;

export const adminLoginRequestSchema = authCredentialsSchema;
export type AdminLoginRequest = z.infer<typeof adminLoginRequestSchema>;

export const adminMeResponseSchema = z.object({
  user: authUserSchema,
});
export type AdminMeResponse = z.infer<typeof adminMeResponseSchema>;

export const adminUserAccessUpdateSchema = z.object({
  role: accountRoleSchema,
  adminPermissions: z.array(adminPermissionSchema).default([]),
});
export type AdminUserAccessUpdate = z.infer<typeof adminUserAccessUpdateSchema>;

export const adminUserBlockUpdateSchema = z.object({
  blocked: z.boolean(),
});
export type AdminUserBlockUpdate = z.infer<typeof adminUserBlockUpdateSchema>;

export const adminUserSummarySchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: accountRoleSchema,
  isBlocked: z.boolean().default(false),
  blockedAt: z.string().nullable().default(null),
  createdAt: z.string(),
  adminPermissions: z.array(adminPermissionSchema),
});
export type AdminUserSummary = z.infer<typeof adminUserSummarySchema>;

export const adminUserListResponseSchema = z.object({
  users: z.array(adminUserSummarySchema),
});
export type AdminUserListResponse = z.infer<typeof adminUserListResponseSchema>;

const adminAnalyticsEventStatusSchema = z.enum(['open', 'closed']);

export const adminAnalyticsEventSummarySchema = z.object({
  eventId: z.string(),
  name: z.string(),
  provider: providerSchema,
  status: adminAnalyticsEventStatusSchema,
  hostEmail: z.string().email(),
  tracksCount: z.number().int().nonnegative(),
  lastTrackAddedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdminAnalyticsEventSummary = z.infer<typeof adminAnalyticsEventSummarySchema>;

export const adminAnalyticsEventsListResponseSchema = z.object({
  events: z.array(adminAnalyticsEventSummarySchema),
});
export type AdminAnalyticsEventsListResponse = z.infer<
  typeof adminAnalyticsEventsListResponseSchema
>;

export const adminAnalyticsEventDetailResponseSchema = z.object({
  event: adminAnalyticsEventSummarySchema.extend({
    description: z.string(),
    magicLinkToken: z.string(),
    closedAt: z.string().nullable(),
    analytics: z.object({
      publicPageViews: z.number().int().nonnegative(),
      hostPageViews: z.number().int().nonnegative(),
      trackedEventActions: z.number().int().nonnegative(),
    }),
    recentTracks: z.array(
      z.object({
        providerTrackId: z.string(),
        name: z.string(),
        artist: z.string(),
        album: z.string(),
        addedAt: z.string(),
        addedBy: z.string(),
      }),
    ),
  }),
});
export type AdminAnalyticsEventDetailResponse = z.infer<
  typeof adminAnalyticsEventDetailResponseSchema
>;

export const adminAnalyticsUserSummarySchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  role: accountRoleSchema,
  isBlocked: z.boolean().default(false),
  blockedAt: z.string().nullable().default(null),
  createdAt: z.string(),
  eventPlaylistsCount: z.number().int().nonnegative(),
  sharedPlaylistsCount: z.number().int().nonnegative(),
});
export type AdminAnalyticsUserSummary = z.infer<typeof adminAnalyticsUserSummarySchema>;

export const adminAnalyticsUsersListResponseSchema = z.object({
  users: z.array(adminAnalyticsUserSummarySchema),
});
export type AdminAnalyticsUsersListResponse = z.infer<typeof adminAnalyticsUsersListResponseSchema>;

export const adminAnalyticsUserEventSummarySchema = z.object({
  eventId: z.string(),
  name: z.string(),
  provider: providerSchema,
  status: adminAnalyticsEventStatusSchema,
  tracksCount: z.number().int().nonnegative(),
  shared: z.boolean(),
  updatedAt: z.string(),
});
export type AdminAnalyticsUserEventSummary = z.infer<typeof adminAnalyticsUserEventSummarySchema>;

export const adminAnalyticsPageViewsByPathSchema = z.object({
  path: z.string(),
  views: z.number().int().nonnegative(),
});
export type AdminAnalyticsPageViewsByPath = z.infer<typeof adminAnalyticsPageViewsByPathSchema>;

export const adminAnalyticsPageViewsByDaySchema = z.object({
  day: z.string(),
  views: z.number().int().nonnegative(),
});
export type AdminAnalyticsPageViewsByDay = z.infer<typeof adminAnalyticsPageViewsByDaySchema>;

const adminUserProfileNameSchema = z.object({
  displayName: z.string().max(80).nullable(),
  firstName: z.string().max(80).nullable(),
  lastName: z.string().max(80).nullable(),
});

export const adminAnalyticsUserDetailResponseSchema = z.object({
  user: adminAnalyticsUserSummarySchema.extend({
    personalInfo: adminUserProfileNameSchema,
    adminPermissions: z.array(adminPermissionSchema),
    events: z.array(adminAnalyticsUserEventSummarySchema),
    pageViewsByPath: z.array(adminAnalyticsPageViewsByPathSchema),
  }),
});
export type AdminAnalyticsUserDetailResponse = z.infer<
  typeof adminAnalyticsUserDetailResponseSchema
>;

export const adminAnalyticsOverviewResponseSchema = z.object({
  totals: z.object({
    usersCount: z.number().int().nonnegative(),
    eventPlaylistsCount: z.number().int().nonnegative(),
    sharedPlaylistsCount: z.number().int().nonnegative(),
    pageViewsCount: z.number().int().nonnegative(),
    uniqueSessionsCount: z.number().int().nonnegative(),
    trackedEventsCount: z.number().int().nonnegative(),
  }),
  pageViewsByPath: z.array(adminAnalyticsPageViewsByPathSchema),
  pageViewsByDay: z.array(adminAnalyticsPageViewsByDaySchema),
});
export type AdminAnalyticsOverviewResponse = z.infer<typeof adminAnalyticsOverviewResponseSchema>;

export const adminAnalyticsOverviewRangeSchema = z.enum([
  '24h',
  '7d',
  '14d',
  '30d',
  '45d',
  '90d',
  'all',
]);
export type AdminAnalyticsOverviewRange = z.infer<typeof adminAnalyticsOverviewRangeSchema>;

export const analyticsEventNameSchema = z.enum([
  'app_page_view',
  'auth_login_submit',
  'auth_login_success',
  'auth_login_failed',
  'auth_register_submit',
  'auth_register_success',
  'auth_register_failed',
  'auth_forgot_password_submit',
  'auth_forgot_password_success',
  'auth_forgot_password_failed',
  'auth_reset_password_submit',
  'auth_reset_password_success',
  'auth_reset_password_failed',
  'provider_connect_started',
  'provider_connect_succeeded',
  'provider_connect_failed',
  'provider_disconnect_succeeded',
  'provider_disconnect_failed',
  'providers_snapshot_loaded',
  'event_create_step_changed',
  'event_create_provider_selected',
  'event_create_submitted',
  'event_create_succeeded',
  'event_create_failed',
  'event_public_load_failed',
  'event_host_load_failed',
  'event_tracks_load_failed',
  'event_track_search_failed',
  'event_track_add_failed',
  'event_track_add_blocked',
  'event_provider_disconnected_warning',
]);
export type AnalyticsEventName = z.infer<typeof analyticsEventNameSchema>;

export const analyticsTargetSchema = z.enum([
  'navigation',
  'auth',
  'providers',
  'events',
  'admin',
  'engagement',
]);
export type AnalyticsTarget = z.infer<typeof analyticsTargetSchema>;

export const analyticsTrackRequestSchema = z.object({
  eventName: analyticsEventNameSchema,
  target: analyticsTargetSchema,
  sessionId: z.string().min(8).max(128),
  path: z.string().min(1).max(512),
  locale: z.enum(['en', 'fr']).optional(),
  source: z.literal('web').default('web'),
  properties: z.record(z.string(), z.unknown()).default({}),
});
export type AnalyticsTrackRequest = z.infer<typeof analyticsTrackRequestSchema>;

export const analyticsTrackResponseSchema = z.object({
  ok: z.literal(true),
});
export type AnalyticsTrackResponse = z.infer<typeof analyticsTrackResponseSchema>;

const birthDateIsoPattern = /^\d{4}-\d{2}-\d{2}$/;

export const personalInfoSchema = z.object({
  displayName: z.string().max(80).nullable(),
  firstName: z.string().max(80).nullable(),
  lastName: z.string().max(80).nullable(),
  birthDate: z.string().regex(birthDateIsoPattern).nullable(),
  country: z.string().max(60).nullable(),
});

export type PersonalInfo = z.infer<typeof personalInfoSchema>;

export const personalInfoResponseSchema = z.object({
  personalInfo: personalInfoSchema,
});

export type PersonalInfoResponse = z.infer<typeof personalInfoResponseSchema>;

export const updatePersonalInfoRequestSchema = z.object({
  displayName: z.string().max(80).nullable().optional(),
  firstName: z.string().max(80).nullable().optional(),
  lastName: z.string().max(80).nullable().optional(),
  birthDate: z.string().regex(birthDateIsoPattern).nullable().optional(),
  country: z.string().max(60).nullable().optional(),
});

export type UpdatePersonalInfoRequest = z.infer<typeof updatePersonalInfoRequestSchema>;

export const userPreferencesThemeSchema = z.enum(['light', 'dark', 'auto']);
export type UserPreferencesTheme = z.infer<typeof userPreferencesThemeSchema>;

export const userPreferencesLocaleSchema = z.enum(['en', 'fr']);
export type UserPreferencesLocale = z.infer<typeof userPreferencesLocaleSchema>;

export const userPreferencesSchema = z.object({
  theme: userPreferencesThemeSchema.nullable(),
  locale: userPreferencesLocaleSchema.nullable(),
});
export type UserPreferences = z.infer<typeof userPreferencesSchema>;

export const userPreferencesResponseSchema = z.object({
  preferences: userPreferencesSchema,
});
export type UserPreferencesResponse = z.infer<typeof userPreferencesResponseSchema>;

export const updateUserPreferencesRequestSchema = z.object({
  theme: userPreferencesThemeSchema.nullable().optional(),
  locale: userPreferencesLocaleSchema.nullable().optional(),
});
export type UpdateUserPreferencesRequest = z.infer<typeof updateUserPreferencesRequestSchema>;

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
export const eventDraftStepSchema = z.number().int().min(1).max(4);
export type EventDraftStep = z.infer<typeof eventDraftStepSchema>;

export const createEventRequestSchema = z.object({
  provider: providerSchema.optional().default('spotify'),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().default(''),
  draftId: z.string().uuid().optional(),
});
export type CreateEventRequest = z.infer<typeof createEventRequestSchema>;

export const updateEventRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().default(''),
});
export type UpdateEventRequest = z.infer<typeof updateEventRequestSchema>;

export const createEventDraftRequestSchema = z.object({
  provider: providerSchema.nullable().optional(),
  name: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  step: eventDraftStepSchema.optional(),
});
export type CreateEventDraftRequest = z.infer<typeof createEventDraftRequestSchema>;

export const updateEventDraftRequestSchema = z
  .object({
    provider: providerSchema.nullable().optional(),
    name: z.string().max(100).optional(),
    description: z.string().max(500).optional(),
    step: eventDraftStepSchema.optional(),
  })
  .refine(
    (data) =>
      data.provider !== undefined ||
      data.name !== undefined ||
      data.description !== undefined ||
      data.step !== undefined,
    {
      message: 'At least one field must be provided.',
    },
  );
export type UpdateEventDraftRequest = z.infer<typeof updateEventDraftRequestSchema>;

export const eventSchema = z.object({
  id: z.string(),
  hostUserId: z.string(),
  provider: providerSchema,
  providerConnectionStatus: providerConnectionStatusSchema,
  providerPlaylistId: z.string(),
  status: eventStatusSchema,
  name: z.string(),
  description: z.string(),
  magicLinkToken: z.string(),
  magicLinkRevokedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  closedAt: z.string().nullable(),
});
export type Event = z.infer<typeof eventSchema>;

export const eventDraftSchema = z.object({
  id: z.string().uuid(),
  hostUserId: z.string(),
  provider: providerSchema.nullable(),
  name: z.string(),
  description: z.string(),
  step: eventDraftStepSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type EventDraft = z.infer<typeof eventDraftSchema>;

export const eventDraftResponseSchema = z.object({
  draft: eventDraftSchema,
});
export type EventDraftResponse = z.infer<typeof eventDraftResponseSchema>;

export const eventDraftListResponseSchema = z.object({
  drafts: z.array(eventDraftSchema),
});
export type EventDraftListResponse = z.infer<typeof eventDraftListResponseSchema>;

export const deleteEventDraftResponseSchema = z.object({
  ok: z.literal(true),
  id: z.string().uuid(),
});
export type DeleteEventDraftResponse = z.infer<typeof deleteEventDraftResponseSchema>;

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
  providerConnectionStatus: providerConnectionStatusSchema,
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

export const removeEventTrackResponseSchema = z.object({
  ok: z.literal(true),
  removed: z.literal(true),
  providerTrackId: z.string(),
});
export type RemoveEventTrackResponse = z.infer<typeof removeEventTrackResponseSchema>;

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

export const emailLocaleSchema = z.enum(['en', 'fr']);
export type EmailLocale = z.infer<typeof emailLocaleSchema>;

export const registrationConfirmationEmailJobSchema = z.object({
  userId: z.string(),
  toEmail: z.string().email(),
  locale: emailLocaleSchema,
  webAppUrl: z.string().url(),
});

export type RegistrationConfirmationEmailJob = z.infer<
  typeof registrationConfirmationEmailJobSchema
>;

export const registrationConfirmationEmailPreviewJobSchema = z.object({
  toEmail: z.string().email(),
  locale: emailLocaleSchema,
  webAppUrl: z.string().url(),
  requestedAt: z.string(),
});

export type RegistrationConfirmationEmailPreviewJob = z.infer<
  typeof registrationConfirmationEmailPreviewJobSchema
>;

export const passwordResetEmailJobSchema = z.object({
  userId: z.string(),
  toEmail: z.string().email(),
  locale: emailLocaleSchema,
  webAppUrl: z.string().url(),
  resetToken: z.string().min(20),
});

export type PasswordResetEmailJob = z.infer<typeof passwordResetEmailJobSchema>;

export const passwordResetEmailPreviewJobSchema = z.object({
  toEmail: z.string().email(),
  locale: emailLocaleSchema,
  webAppUrl: z.string().url(),
  resetToken: z.string().min(20),
  requestedAt: z.string(),
});

export type PasswordResetEmailPreviewJob = z.infer<typeof passwordResetEmailPreviewJobSchema>;

export const QUEUES = {
  sync: 'sync',
  notifications: 'notifications',
} as const;

export const JOBS = {
  pullPlaylists: 'sync:pullPlaylists',
  sendRegistrationConfirmationEmail: 'notifications:sendRegistrationConfirmationEmail',
  sendRegistrationConfirmationEmailPreview:
    'notifications:sendRegistrationConfirmationEmailPreview',
  sendPasswordResetEmail: 'notifications:sendPasswordResetEmail',
  sendPasswordResetEmailPreview: 'notifications:sendPasswordResetEmailPreview',
} as const;
