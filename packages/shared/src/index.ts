import { z } from 'zod';

export const providerSchema = z.enum(['spotify', 'apple']);
export type Provider = z.infer<typeof providerSchema>;

export const eventCloseReasonSchema = z.enum(['provider_playlist_missing']);
export type EventCloseReason = z.infer<typeof eventCloseReasonSchema>;

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

export const accountStateSchema = z.enum(['active', 'blocked', 'pending_deletion', 'deleted']);
export type AccountState = z.infer<typeof accountStateSchema>;

export const adminPermissionScopeSchema = z.enum([
  'dashboard',
  'users',
  'events',
  'integrations',
  'emails',
  'analytics',
  'admin_users',
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
  accountState: accountStateSchema.default('active'),
  isTestAccount: z.boolean().default(false),
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

export const adminUserTestAccountUpdateSchema = z.object({
  isTestAccount: z.boolean(),
});
export type AdminUserTestAccountUpdate = z.infer<typeof adminUserTestAccountUpdateSchema>;

export const adminUserDeletionRequestSchema = z.object({
  reason: z.string().trim().max(500).nullable().optional().default(null),
});
export type AdminUserDeletionRequest = z.infer<typeof adminUserDeletionRequestSchema>;

export const adminUserResetFlowResponseSchema = z.object({
  ok: z.literal(true),
  reset: z.literal(true),
  releasedEmail: z.string().email(),
});
export type AdminUserResetFlowResponse = z.infer<typeof adminUserResetFlowResponseSchema>;

export const adminUserDeletionResponseSchema = z.object({
  ok: z.literal(true),
  scheduled: z.literal(true),
  deletionScheduledFor: z.string(),
});
export type AdminUserDeletionResponse = z.infer<typeof adminUserDeletionResponseSchema>;

export const adminUserSummarySchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: accountRoleSchema,
  isBlocked: z.boolean().default(false),
  blockedAt: z.string().nullable().default(null),
  accountState: accountStateSchema.default('active'),
  isTestAccount: z.boolean().default(false),
  deletionRequestedAt: z.string().nullable().default(null),
  deletionScheduledFor: z.string().nullable().default(null),
  deletedAt: z.string().nullable().default(null),
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
  accountState: accountStateSchema.default('active'),
  isTestAccount: z.boolean().default(false),
  deletionRequestedAt: z.string().nullable().default(null),
  deletionScheduledFor: z.string().nullable().default(null),
  deletedAt: z.string().nullable().default(null),
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

export const adminAnalyticsFunnelStepSchema = z.enum([
  'sessions',
  'registered',
  'providerConnected',
  'eventCreated',
  'shared',
]);
export type AdminAnalyticsFunnelStep = z.infer<typeof adminAnalyticsFunnelStepSchema>;

export const adminAnalyticsFunnelEntrySchema = z.object({
  step: adminAnalyticsFunnelStepSchema,
  count: z.number().int().nonnegative(),
});
export type AdminAnalyticsFunnelEntry = z.infer<typeof adminAnalyticsFunnelEntrySchema>;

export const adminAnalyticsEventBreakdownRowSchema = z.object({
  eventName: z.string(),
  target: z.string(),
  count: z.number().int().nonnegative(),
  sessions: z.number().int().nonnegative(),
});
export type AdminAnalyticsEventBreakdownRow = z.infer<typeof adminAnalyticsEventBreakdownRowSchema>;

export const adminAnalyticsActiveSessionsByDaySchema = z.object({
  day: z.string(),
  sessions: z.number().int().nonnegative(),
});
export type AdminAnalyticsActiveSessionsByDay = z.infer<
  typeof adminAnalyticsActiveSessionsByDaySchema
>;

export const adminAnalyticsSiteSectionSchema = z.object({
  section: z.string(),
  views: z.number().int().nonnegative(),
});
export type AdminAnalyticsSiteSection = z.infer<typeof adminAnalyticsSiteSectionSchema>;

export const adminAnalyticsSiteClickSchema = z.object({
  label: z.string(),
  clicks: z.number().int().nonnegative(),
});
export type AdminAnalyticsSiteClick = z.infer<typeof adminAnalyticsSiteClickSchema>;

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
  funnel: z.array(adminAnalyticsFunnelEntrySchema),
  eventBreakdown: z.array(adminAnalyticsEventBreakdownRowSchema),
  engagement: z.object({
    returningSessionsCount: z.number().int().nonnegative(),
    avgEventsPerSession: z.number().nonnegative(),
    activeSessionsByDay: z.array(adminAnalyticsActiveSessionsByDaySchema),
  }),
  site: z.object({
    uniqueVisitors: z.number().int().nonnegative(),
    pageViewsCount: z.number().int().nonnegative(),
    avgEngagedSeconds: z.number().nonnegative(),
    trafficByDay: z.array(adminAnalyticsPageViewsByDaySchema),
    topPages: z.array(adminAnalyticsPageViewsByPathSchema),
    topSections: z.array(adminAnalyticsSiteSectionSchema),
    topClicks: z.array(adminAnalyticsSiteClickSchema),
  }),
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
  'auth_logout',
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
  'event_public_viewed',
  'event_public_load_failed',
  'event_host_load_failed',
  'event_tracks_load_failed',
  'event_track_search_failed',
  'event_track_add_succeeded',
  'event_track_add_failed',
  'event_track_add_blocked',
  'event_closed',
  'event_reopened',
  'event_provider_disconnected_warning',
  'sync_create_submitted',
  'sync_create_succeeded',
  'sync_create_failed',
  'sync_subscribed',
  'sync_unsubscribed',
  'site_page_view',
  'site_section_viewed',
  'site_cta_click',
  'site_time_on_page',
]);
export type AnalyticsEventName = z.infer<typeof analyticsEventNameSchema>;

export const analyticsTargetSchema = z.enum([
  'navigation',
  'auth',
  'providers',
  'events',
  'sync',
  'admin',
  'engagement',
  'marketing',
]);
export type AnalyticsTarget = z.infer<typeof analyticsTargetSchema>;

export const ANALYTICS_PROPERTIES_MAX_KEYS = 20;
export const ANALYTICS_PROPERTIES_MAX_KEY_LENGTH = 64;
export const ANALYTICS_PROPERTIES_MAX_BYTES = 2_048;

/**
 * Free-form event properties are written straight to the database by an
 * unauthenticated endpoint, so they are bounded in shape and size.
 */
export const analyticsPropertiesSchema = z
  .record(z.string().max(ANALYTICS_PROPERTIES_MAX_KEY_LENGTH), z.unknown())
  .refine((value) => Object.keys(value).length <= ANALYTICS_PROPERTIES_MAX_KEYS, {
    message: `properties may contain at most ${ANALYTICS_PROPERTIES_MAX_KEYS} keys`,
  })
  .refine(
    (value) => {
      try {
        return JSON.stringify(value).length <= ANALYTICS_PROPERTIES_MAX_BYTES;
      } catch {
        return false;
      }
    },
    { message: `properties must serialize to at most ${ANALYTICS_PROPERTIES_MAX_BYTES} bytes` },
  );

export const analyticsTrackRequestSchema = z.object({
  eventName: analyticsEventNameSchema,
  target: analyticsTargetSchema,
  sessionId: z.string().min(8).max(128),
  path: z.string().min(1).max(512),
  locale: z.enum(['en', 'fr']).optional(),
  source: z.enum(['web', 'site']).default('web'),
  /**
   * Where this session came from, sent once on its first event. The `Referer`
   * header cannot supply this: analytics beacons go cross-origin to the API, so
   * browsers trim that header to our own origin under the default
   * `strict-origin-when-cross-origin` policy.
   */
  referrer: z.string().max(512).optional(),
  properties: analyticsPropertiesSchema.default({}),
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
  closeReason: eventCloseReasonSchema.nullable().optional(),
  name: z.string(),
  description: z.string(),
  coverImageUrl: z.string().nullable().optional(),
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
  closeReason: eventCloseReasonSchema.nullable().optional(),
  name: z.string(),
  description: z.string(),
  coverImageUrl: z.string().nullable().optional(),
  createdAt: z.string(),
  isOwner: z.boolean().default(false),
  isTracked: z.boolean().default(false),
});
export type EventPublic = z.infer<typeof eventPublicSchema>;

export const eventPublicResponseSchema = z.object({
  event: eventPublicSchema,
});
export type EventPublicResponse = z.infer<typeof eventPublicResponseSchema>;

export const eventTrackingResponseSchema = z.object({
  ok: z.literal(true),
  trackedAt: z.string().nullable(),
});
export type EventTrackingResponse = z.infer<typeof eventTrackingResponseSchema>;

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
  previewUrl: z.string().url().nullable(),
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

// ---------------------------------------------------------------------------
// Sync playlists
// ---------------------------------------------------------------------------

export const syncStatusSchema = z.enum(['active', 'revoked']);
export type SyncStatus = z.infer<typeof syncStatusSchema>;

export const syncImportStatusSchema = z.enum(['pending', 'completed', 'failed']);
export type SyncImportStatus = z.infer<typeof syncImportStatusSchema>;

export const syncModeSchema = z.enum(['host_only', 'bidirectional']);
export type SyncMode = z.infer<typeof syncModeSchema>;

// Distinguishes a shared/synced list (created to share via magic link) from a
// one-time transfer (a playlist moved into the user's own other library).
export const syncKindSchema = z.enum(['shared', 'transfer']);
export type SyncKind = z.infer<typeof syncKindSchema>;

// When a playlist on a provider was itself created by a previous Synqit
// transfer, `origin` records where it came from so the UI can flag a
// round-trip (transferring it back to the platform it originated on).
export const providerPlaylistOriginSchema = z.object({
  provider: providerSchema,
  syncName: z.string(),
});
export type ProviderPlaylistOrigin = z.infer<typeof providerPlaylistOriginSchema>;

// When this same source playlist was already used as the source of a prior
// transfer, `priorTransfer` records where it was sent (and when) so the UI can
// warn about transferring it again.
export const providerPlaylistPriorTransferSchema = z.object({
  destinationProviders: z.array(providerSchema),
  lastTransferredAt: z.string().nullable(),
});
export type ProviderPlaylistPriorTransfer = z.infer<typeof providerPlaylistPriorTransferSchema>;

export const providerPlaylistItemSchema = z.object({
  providerPlaylistId: z.string().min(1),
  name: z.string(),
  trackCount: z.number().int().nonnegative().nullable(),
  coverImageUrl: z.string().nullable(),
  origin: providerPlaylistOriginSchema.nullable().optional(),
  priorTransfer: providerPlaylistPriorTransferSchema.nullable().optional(),
});
export type ProviderPlaylistItem = z.infer<typeof providerPlaylistItemSchema>;

export const providerPlaylistListResponseSchema = z.object({
  playlists: z.array(providerPlaylistItemSchema),
  hasMore: z.boolean(),
});
export type ProviderPlaylistListResponse = z.infer<typeof providerPlaylistListResponseSchema>;

export const providerPlaylistTrackCountResponseSchema = z.object({
  trackCount: z.number().int().nonnegative(),
});
export type ProviderPlaylistTrackCountResponse = z.infer<
  typeof providerPlaylistTrackCountResponseSchema
>;

export const providerPlaylistTrackSchema = z.object({
  providerTrackId: z.string(),
  name: z.string(),
  artist: z.string(),
  album: z.string(),
  durationMs: z.number().int().nonnegative(),
  artworkUrl: z.string().nullable(),
});
export type ProviderPlaylistTrack = z.infer<typeof providerPlaylistTrackSchema>;

export const providerPlaylistTracksResponseSchema = z.object({
  tracks: z.array(providerPlaylistTrackSchema),
});
export type ProviderPlaylistTracksResponse = z.infer<typeof providerPlaylistTracksResponseSchema>;

export const createSyncRequestSchema = z.object({
  provider: providerSchema,
  providerPlaylistId: z.string().min(1),
  name: z.string().min(1).max(200),
  trackCount: z.number().int().nonnegative().nullable(),
  syncMode: syncModeSchema,
  kind: syncKindSchema.optional(),
});
export type CreateSyncRequest = z.infer<typeof createSyncRequestSchema>;

export const updateSyncRequestSchema = z
  .object({
    syncMode: syncModeSchema.optional(),
  })
  .refine((data) => data.syncMode !== undefined, {
    message: 'At least one field must be provided.',
  });
export type UpdateSyncRequest = z.infer<typeof updateSyncRequestSchema>;

export const syncItemSchema = z.object({
  id: z.string(),
  senderUserId: z.string(),
  provider: providerSchema,
  providerPlaylistId: z.string(),
  name: z.string(),
  trackCount: z.number().int().nonnegative().nullable(),
  kind: syncKindSchema.default('shared'),
  syncMode: syncModeSchema,
  autoSyncEnabled: z.boolean().default(true),
  lastSyncedAt: z.string().nullable().default(null),
  lastError: z.string().nullable().default(null),
  magicLinkToken: z.string(),
  magicLinkRevokedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SyncItem = z.infer<typeof syncItemSchema>;

export const syncResponseSchema = z.object({
  sync: syncItemSchema,
  magicLinkUrl: z.string().url(),
});
export type SyncResponse = z.infer<typeof syncResponseSchema>;

export const syncListResponseSchema = z.object({
  ownedSyncs: z.array(syncItemSchema),
  subscribedSyncs: z.array(syncItemSchema),
});
export type SyncListResponse = z.infer<typeof syncListResponseSchema>;

export const syncDetailTrackSchema = z.object({
  providerTrackId: z.string(),
  name: z.string(),
  artist: z.string(),
  album: z.string(),
  durationMs: z.number().int().nonnegative(),
  artworkUrl: z.string().nullable(),
});
export type SyncDetailTrack = z.infer<typeof syncDetailTrackSchema>;

export const syncSubscriberPlatformStatSchema = z.object({
  provider: providerSchema,
  count: z.number().int().nonnegative(),
});
export type SyncSubscriberPlatformStat = z.infer<typeof syncSubscriberPlatformStatSchema>;

export const syncDetailItemSchema = syncItemSchema.extend({
  subscriberCount: z.number().int().nonnegative(),
  subscriberPlatformStats: z.array(syncSubscriberPlatformStatSchema),
  tracks: z.array(syncDetailTrackSchema),
});
export type SyncDetailItem = z.infer<typeof syncDetailItemSchema>;

export const syncDetailResponseSchema = z.object({
  sync: syncDetailItemSchema,
});
export type SyncDetailResponse = z.infer<typeof syncDetailResponseSchema>;

export const syncPublicTrackSchema = z.object({
  name: z.string(),
  artist: z.string(),
  album: z.string(),
  artworkUrl: z.string().nullable(),
});
export type SyncPublicTrack = z.infer<typeof syncPublicTrackSchema>;

export const syncPublicItemSchema = z.object({
  id: z.string(),
  provider: providerSchema,
  syncMode: syncModeSchema,
  name: z.string(),
  trackCount: z.number().int().nonnegative(),
  isRevoked: z.boolean(),
  isOwner: z.boolean().default(false),
  isSubscribed: z.boolean().default(false),
  subscriberCount: z.number().int().nonnegative(),
  tracks: z.array(syncPublicTrackSchema),
});
export type SyncPublicItem = z.infer<typeof syncPublicItemSchema>;

export const syncPublicResponseSchema = z.object({
  sync: syncPublicItemSchema,
});
export type SyncPublicResponse = z.infer<typeof syncPublicResponseSchema>;

export const importSyncRequestSchema = z.object({
  recipientProvider: providerSchema,
});
export type ImportSyncRequest = z.infer<typeof importSyncRequestSchema>;

export const importSyncResponseSchema = z.object({
  ok: z.literal(true),
  matchedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
});
export type ImportSyncResponse = z.infer<typeof importSyncResponseSchema>;

// ---------------------------------------------------------------------------
// Transfers
//
// A transfer batch moves one or more playlists from one provider to another.
// Each playlist is its own item so it can succeed, fail and retry on its own.
// ---------------------------------------------------------------------------

export const transferItemStatusSchema = z.enum(['queued', 'running', 'completed', 'failed']);
export type TransferItemStatus = z.infer<typeof transferItemStatusSchema>;

/** `partial` means every item finished but at least one failed. */
export const transferBatchStatusSchema = z.enum([
  'queued',
  'running',
  'completed',
  'partial',
  'failed',
]);
export type TransferBatchStatus = z.infer<typeof transferBatchStatusSchema>;

export const transferPlaylistSelectionSchema = z.object({
  providerPlaylistId: z.string().min(1),
  name: z.string().min(1).max(200),
  trackCount: z.number().int().nonnegative().nullable(),
});
export type TransferPlaylistSelection = z.infer<typeof transferPlaylistSelectionSchema>;

/** The cap is a guard rail on one request, not the plan entitlement. */
export const TRANSFER_MAX_PLAYLISTS_PER_BATCH = 50;

export const createTransferRequestSchema = z
  .object({
    sourceProvider: providerSchema,
    destinationProvider: providerSchema,
    playlists: z
      .array(transferPlaylistSelectionSchema)
      .min(1)
      .max(TRANSFER_MAX_PLAYLISTS_PER_BATCH),
  })
  .refine((data) => data.sourceProvider !== data.destinationProvider, {
    message: 'Source and destination providers must differ.',
    path: ['destinationProvider'],
  })
  .refine(
    (data) =>
      new Set(data.playlists.map((playlist) => playlist.providerPlaylistId)).size ===
      data.playlists.length,
    { message: 'The same playlist cannot be selected twice.', path: ['playlists'] },
  );
export type CreateTransferRequest = z.infer<typeof createTransferRequestSchema>;

export const transferItemSchema = z.object({
  id: z.string(),
  providerPlaylistId: z.string(),
  name: z.string(),
  trackCount: z.number().int().nonnegative().nullable(),
  status: transferItemStatusSchema,
  syncId: z.string().nullable(),
  matchedCount: z.number().int().nonnegative().nullable(),
  skippedCount: z.number().int().nonnegative().nullable(),
  errorMessage: z.string().nullable(),
  position: z.number().int().nonnegative(),
});
export type TransferItem = z.infer<typeof transferItemSchema>;

export const transferBatchSchema = z.object({
  id: z.string(),
  sourceProvider: providerSchema,
  destinationProvider: providerSchema,
  status: transferBatchStatusSchema,
  createdAt: z.string(),
  completedAt: z.string().nullable(),
  items: z.array(transferItemSchema),
});
export type TransferBatch = z.infer<typeof transferBatchSchema>;

export const transferBatchResponseSchema = z.object({
  batch: transferBatchSchema,
});
export type TransferBatchResponse = z.infer<typeof transferBatchResponseSchema>;

export const transferPlaylistJobSchema = z.object({
  batchId: z.string().uuid(),
  itemId: z.string().uuid(),
});
export type TransferPlaylistJob = z.infer<typeof transferPlaylistJobSchema>;

export const dashboardOwnerEventActivitySchema = z.object({
  eventId: z.string(),
  name: z.string(),
  addedTrackCount24h: z.number().int().nonnegative(),
  latestActivityAt: z.string().nullable(),
});
export type DashboardOwnerEventActivity = z.infer<typeof dashboardOwnerEventActivitySchema>;

export const dashboardTrackedEventActivitySchema = z.object({
  eventId: z.string(),
  magicLinkToken: z.string(),
  name: z.string(),
  addedTrackCount24h: z.number().int().nonnegative(),
  latestActivityAt: z.string().nullable(),
});
export type DashboardTrackedEventActivity = z.infer<typeof dashboardTrackedEventActivitySchema>;

export const dashboardVisitedEventActivitySchema = z.object({
  eventId: z.string(),
  magicLinkToken: z.string(),
  name: z.string(),
  addedTrackCount24h: z.number().int().nonnegative(),
  latestActivityAt: z.string().nullable(),
});
export type DashboardVisitedEventActivity = z.infer<typeof dashboardVisitedEventActivitySchema>;

export const dashboardRecentSubscriberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  subscribedAt: z.string(),
});
export type DashboardRecentSubscriber = z.infer<typeof dashboardRecentSubscriberSchema>;

export const dashboardOwnerSyncActivitySchema = z.object({
  syncId: z.string(),
  name: z.string(),
  totalSubscriberCount: z.number().int().nonnegative(),
  newSubscriberCount24h: z.number().int().nonnegative(),
  recentSubscribers: z.array(dashboardRecentSubscriberSchema),
  latestActivityAt: z.string().nullable(),
});
export type DashboardOwnerSyncActivity = z.infer<typeof dashboardOwnerSyncActivitySchema>;

export const dashboardSubscriberSyncActivitySchema = z.object({
  syncId: z.string(),
  name: z.string(),
  addedTrackCount7d: z.number().int().nonnegative(),
  ownerAddedTracks7d: z.boolean(),
  latestActivityAt: z.string().nullable(),
});
export type DashboardSubscriberSyncActivity = z.infer<typeof dashboardSubscriberSyncActivitySchema>;

export const dashboardSummaryResponseSchema = z.object({
  ownerEventActivity: z.array(dashboardOwnerEventActivitySchema),
  trackedEventActivity: z.array(dashboardTrackedEventActivitySchema),
  visitedEventActivity: z.array(dashboardVisitedEventActivitySchema),
  ownerSyncActivity: z.array(dashboardOwnerSyncActivitySchema),
  subscriberSyncActivity: z.array(dashboardSubscriberSyncActivitySchema),
});
export type DashboardSummaryResponse = z.infer<typeof dashboardSummaryResponseSchema>;

export const dashboardTopFollowerSchema = z.object({
  userId: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  subscriptionCount: z.number().int().nonnegative(),
  latestSubscribedAt: z.string(),
});
export type DashboardTopFollower = z.infer<typeof dashboardTopFollowerSchema>;

export const dashboardTopFollowersResponseSchema = z.object({
  followers: z.array(dashboardTopFollowerSchema),
  totalCount: z.number().int().nonnegative(),
});
export type DashboardTopFollowersResponse = z.infer<typeof dashboardTopFollowersResponseSchema>;

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

export const weeklyRecapPlaylistKindSchema = z.enum([
  'owned_sync',
  'subscribed_sync',
  'hosted_event',
  'followed_event',
]);
export type WeeklyRecapPlaylistKind = z.infer<typeof weeklyRecapPlaylistKindSchema>;

export const weeklyRecapPlaylistSchema = z.object({
  kind: weeklyRecapPlaylistKindSchema,
  name: z.string().min(1),
  url: z.string().url(),
  newTrackCount: z.number().int().positive(),
});
export type WeeklyRecapPlaylist = z.infer<typeof weeklyRecapPlaylistSchema>;

export const weeklyRecapEmailJobSchema = z.object({
  userId: z.string(),
  toEmail: z.string().email(),
  locale: emailLocaleSchema,
  webAppUrl: z.string().url(),
  windowDays: z.number().int().positive(),
  totalNewTracks: z.number().int().positive(),
  playlists: z.array(weeklyRecapPlaylistSchema).min(1),
});
export type WeeklyRecapEmailJob = z.infer<typeof weeklyRecapEmailJobSchema>;

export const weeklyRecapEmailPreviewJobSchema = z.object({
  toEmail: z.string().email(),
  locale: emailLocaleSchema,
  webAppUrl: z.string().url(),
  requestedAt: z.string(),
});
export type WeeklyRecapEmailPreviewJob = z.infer<typeof weeklyRecapEmailPreviewJobSchema>;

export const QUEUES = {
  sync: 'sync',
  notifications: 'notifications',
  // Consumed in-process by the API, which is where provider clients, token
  // decryption and Prisma already live. Kept separate from `sync` so the
  // standalone worker does not pick jobs it cannot run.
  transfers: 'transfers',
} as const;

export const JOBS = {
  pullPlaylists: 'sync:pullPlaylists',
  transferPlaylist: 'transfers:transferPlaylist',
  sendRegistrationConfirmationEmail: 'notifications:sendRegistrationConfirmationEmail',
  sendRegistrationConfirmationEmailPreview:
    'notifications:sendRegistrationConfirmationEmailPreview',
  sendPasswordResetEmail: 'notifications:sendPasswordResetEmail',
  sendPasswordResetEmailPreview: 'notifications:sendPasswordResetEmailPreview',
  sendWeeklyRecapEmail: 'notifications:sendWeeklyRecapEmail',
  sendWeeklyRecapEmailPreview: 'notifications:sendWeeklyRecapEmailPreview',
} as const;

export * from './env';
