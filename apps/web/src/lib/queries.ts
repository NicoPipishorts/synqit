/**
 * Centralised TanStack Query keys and typed fetcher functions.
 *
 * Query key structure: [domain, ...params]
 * This makes it easy to invalidate a whole domain:
 *   queryClient.invalidateQueries({ queryKey: queryKeys.events.all() })
 * or a single entity:
 *   queryClient.invalidateQueries({ queryKey: queryKeys.events.detail(eventId) })
 */

import {
  createSyncRequestSchema,
  dashboardSummaryResponseSchema,
  deleteEventDraftResponseSchema,
  eventDraftListResponseSchema,
  eventDraftResponseSchema,
  eventListResponseSchema,
  eventTrackingResponseSchema,
  eventResponseSchema,
  eventTracksResponseSchema,
  importSyncRequestSchema,
  importSyncResponseSchema,
  integrationDisconnectResponseSchema,
  integrationListResponseSchema,
  oauthCallbackResponseSchema,
  personalInfoResponseSchema,
  providerPlaylistListResponseSchema,
  providerPlaylistTrackCountResponseSchema,
  syncDetailResponseSchema,
  syncListResponseSchema,
  syncPublicResponseSchema,
  syncResponseSchema,
  updateEventRequestSchema,
  updateSyncRequestSchema,
  userPreferencesResponseSchema,
  type ImportSyncResponse,
  type DashboardSummaryResponse,
  type ProviderPlaylistItem,
  type PersonalInfo,
  type SyncDetailItem,
  type SyncItem,
  type SyncPublicItem,
  type UserPreferences,
} from '@synqit/shared';
import type { EventDraft } from '@synqit/shared';

import { callApi } from './api';
import { toApiAssetUrl } from './apiAssetUrl';
import { getAccessToken } from './auth';
import { parseOkResponse } from './client-models';
import type { EventTrackItem, HostEvent, HostEventDraft } from './events';

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const queryKeys = {
  events: {
    all: () => ['events'] as const,
    list: () => ['events', 'list'] as const,
    detail: (eventId: string) => ['events', 'detail', eventId] as const,
    tracks: (eventId: string) => ['events', 'tracks', eventId] as const,
  },
  drafts: {
    all: () => ['drafts'] as const,
    list: () => ['drafts', 'list'] as const,
    detail: (draftId: string) => ['drafts', 'detail', draftId] as const,
  },
  integrations: {
    all: () => ['integrations'] as const,
    list: () => ['integrations', 'list'] as const,
    snapshot: () => ['integrations', 'snapshot'] as const,
  },
  preferences: {
    all: () => ['preferences'] as const,
    detail: () => ['preferences', 'detail'] as const,
  },
  personalInfo: {
    all: () => ['personalInfo'] as const,
    detail: () => ['personalInfo', 'detail'] as const,
  },
} as const;

// ---------------------------------------------------------------------------
// Helper: require access token (throws so React Query surfaces the error)
// ---------------------------------------------------------------------------

export const requireToken = (): string => {
  const token = getAccessToken();
  if (!token) {
    throw new Error('missing_access_token');
  }
  return token;
};

// ---------------------------------------------------------------------------
// Event fetchers
// ---------------------------------------------------------------------------

export const mapApiEvent = (event: {
  id: string;
  name: string;
  description: string;
  coverImageUrl?: string | null;
  provider: HostEvent['provider'];
  providerConnectionStatus: HostEvent['providerConnectionStatus'];
  status: HostEvent['status'];
  closeReason?: HostEvent['closeReason'];
  magicLinkToken: string;
  magicLinkRevokedAt: string | null;
  updatedAt: string;
}): HostEvent => ({
  id: event.id,
  name: event.name,
  description: event.description,
  coverImageUrl: toApiAssetUrl(event.coverImageUrl),
  provider: event.provider,
  providerConnectionStatus: event.providerConnectionStatus,
  status: event.status,
  closeReason: event.closeReason ?? null,
  magicLinkToken: event.magicLinkToken,
  magicLinkRevokedAt: event.magicLinkRevokedAt,
  updatedAt: event.updatedAt,
});

export const fetchEvents = async (): Promise<HostEvent[]> => {
  const token = requireToken();
  const result = await callApi(
    '/v1/playlists',
    { method: 'GET', headers: { authorization: `Bearer ${token}` } },
    (payload) => eventListResponseSchema.parse(payload),
  );
  return result.events.map(mapApiEvent);
};

export const fetchEvent = async (eventId: string): Promise<HostEvent> => {
  const token = requireToken();
  const result = await callApi(
    `/v1/playlists/${encodeURIComponent(eventId)}`,
    { method: 'GET', headers: { authorization: `Bearer ${token}` } },
    (payload) => eventResponseSchema.parse(payload),
  );
  return mapApiEvent(result.event);
};

export const fetchEventTracks = async (eventId: string): Promise<EventTrackItem[]> => {
  const token = requireToken();
  const result = await callApi(
    `/v1/playlists/${encodeURIComponent(eventId)}/tracks`,
    { method: 'GET', headers: { authorization: `Bearer ${token}` } },
    (payload) => eventTracksResponseSchema.parse(payload),
  );
  return result.tracks;
};

// ---------------------------------------------------------------------------
// Draft fetchers
// ---------------------------------------------------------------------------

export const fetchDrafts = async (): Promise<HostEventDraft[]> => {
  const token = requireToken();
  const result = await callApi(
    '/v1/playlists/drafts',
    { method: 'GET', headers: { authorization: `Bearer ${token}` } },
    (payload) => eventDraftListResponseSchema.parse(payload),
  );
  return result.drafts.map((d) => ({
    id: d.id,
    provider: d.provider,
    name: d.name,
    description: d.description,
    step: d.step as 1 | 2 | 3 | 4,
    updatedAt: d.updatedAt,
  }));
};

export const fetchDraft = async (draftId: string): Promise<EventDraft> => {
  const token = requireToken();
  const result = await callApi(
    `/v1/playlists/drafts/${draftId}`,
    { method: 'GET', headers: { authorization: `Bearer ${token}` } },
    (payload) => eventDraftResponseSchema.parse(payload),
  );
  return result.draft;
};

// ---------------------------------------------------------------------------
// Integration fetchers
// ---------------------------------------------------------------------------

export type IntegrationStatus = 'connected' | 'not_connected';
export type IntegrationMap = Record<'spotify' | 'apple', IntegrationStatus>;

export type ProviderIntegrationState = {
  status: IntegrationStatus;
  connectedAt: string | null;
  expiresAt: string | null;
};

export type IntegrationsSnapshot = {
  byProvider: Record<'spotify' | 'apple', ProviderIntegrationState>;
  eventCountByProvider: Record<'spotify' | 'apple', number>;
};

export const fetchIntegrations = async (): Promise<IntegrationMap> => {
  const token = requireToken();
  const result = await callApi(
    '/v1/integrations',
    { method: 'GET', headers: { authorization: `Bearer ${token}` } },
    (payload) => integrationListResponseSchema.parse(payload),
  );
  const map: IntegrationMap = { spotify: 'not_connected', apple: 'not_connected' };
  for (const integration of result.integrations) {
    map[integration.provider] = integration.status;
  }
  return map;
};

export const fetchPersonalInfo = async (): Promise<PersonalInfo> => {
  const token = requireToken();
  const result = await callApi(
    '/v1/auth/personal-info',
    { method: 'GET', headers: { authorization: `Bearer ${token}` } },
    (payload) => personalInfoResponseSchema.parse(payload),
  );
  return result.personalInfo;
};

export const fetchIntegrationsSnapshot = async (): Promise<IntegrationsSnapshot> => {
  const token = requireToken();
  const [integrationResult, eventResult] = await Promise.all([
    callApi(
      '/v1/integrations',
      { method: 'GET', headers: { authorization: `Bearer ${token}` } },
      (payload) => integrationListResponseSchema.parse(payload),
    ),
    callApi(
      '/v1/playlists',
      { method: 'GET', headers: { authorization: `Bearer ${token}` } },
      (payload) => eventListResponseSchema.parse(payload),
    ),
  ]);

  const byProvider: IntegrationsSnapshot['byProvider'] = {
    spotify: { status: 'not_connected', connectedAt: null, expiresAt: null },
    apple: { status: 'not_connected', connectedAt: null, expiresAt: null },
  };
  for (const integration of integrationResult.integrations) {
    byProvider[integration.provider] = {
      status: integration.status,
      connectedAt: integration.connectedAt ?? null,
      expiresAt: integration.expiresAt ?? null,
    };
  }

  const eventCountByProvider: IntegrationsSnapshot['eventCountByProvider'] = {
    spotify: 0,
    apple: 0,
  };
  for (const event of eventResult.events) {
    eventCountByProvider[event.provider] += 1;
  }

  return { byProvider, eventCountByProvider };
};

// ---------------------------------------------------------------------------
// Event mutations
// ---------------------------------------------------------------------------

export const updateEvent = async (params: {
  eventId: string;
  name: string;
  description: string;
}): Promise<HostEvent> => {
  const token = requireToken();
  const payload = updateEventRequestSchema.parse({
    name: params.name,
    description: params.description,
  });
  const result = await callApi(
    `/v1/playlists/${encodeURIComponent(params.eventId)}`,
    {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    },
    (responsePayload) => eventResponseSchema.parse(responsePayload),
  );
  return mapApiEvent(result.event);
};

export const uploadEventImage = async (params: {
  eventId: string;
  imageDataUrl: string;
}): Promise<HostEvent> => {
  const token = requireToken();
  const result = await callApi(
    `/v1/playlists/${encodeURIComponent(params.eventId)}/image`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({ imageDataUrl: params.imageDataUrl }),
    },
    (payload) => eventResponseSchema.parse(payload),
  );
  return mapApiEvent(result.event);
};

export const deleteEventImage = async (eventId: string): Promise<HostEvent> => {
  const token = requireToken();
  const result = await callApi(
    `/v1/playlists/${encodeURIComponent(eventId)}/image`,
    { method: 'DELETE', headers: { authorization: `Bearer ${token}` } },
    (payload) => eventResponseSchema.parse(payload),
  );
  return mapApiEvent(result.event);
};

export const closeEvent = async (eventId: string): Promise<HostEvent> => {
  const token = requireToken();
  const result = await callApi(
    `/v1/playlists/${encodeURIComponent(eventId)}/close`,
    { method: 'POST', headers: { authorization: `Bearer ${token}` } },
    (payload) => eventResponseSchema.parse(payload),
  );
  return mapApiEvent(result.event);
};

export const reopenEvent = async (eventId: string): Promise<HostEvent> => {
  const token = requireToken();
  const result = await callApi(
    `/v1/playlists/${encodeURIComponent(eventId)}/reopen`,
    { method: 'POST', headers: { authorization: `Bearer ${token}` } },
    (payload) => eventResponseSchema.parse(payload),
  );
  return mapApiEvent(result.event);
};

export const revokeMagicLink = async (eventId: string): Promise<HostEvent> => {
  const token = requireToken();
  const result = await callApi(
    `/v1/playlists/${encodeURIComponent(eventId)}/magic-link/revoke`,
    { method: 'POST', headers: { authorization: `Bearer ${token}` } },
    (payload) => eventResponseSchema.parse(payload),
  );
  return mapApiEvent(result.event);
};

export const regenerateMagicLink = async (eventId: string): Promise<HostEvent> => {
  const token = requireToken();
  const result = await callApi(
    `/v1/playlists/${encodeURIComponent(eventId)}/magic-link/regenerate`,
    { method: 'POST', headers: { authorization: `Bearer ${token}` } },
    (payload) => eventResponseSchema.parse(payload),
  );
  return mapApiEvent(result.event);
};

// ---------------------------------------------------------------------------
// Draft mutations
// ---------------------------------------------------------------------------

export const createDraft = async (params: {
  step: 1 | 2 | 3 | 4;
  provider: 'spotify' | 'apple' | null;
  name: string;
  description: string;
}): Promise<EventDraft> => {
  const token = requireToken();
  const result = await callApi(
    '/v1/playlists/drafts',
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify(params),
    },
    (payload) => eventDraftResponseSchema.parse(payload),
  );
  return result.draft;
};

export const updateDraft = async (params: {
  draftId: string;
  step: 1 | 2 | 3 | 4;
  provider: 'spotify' | 'apple' | null;
  name: string;
  description: string;
}): Promise<EventDraft> => {
  const token = requireToken();
  const result = await callApi(
    `/v1/playlists/drafts/${params.draftId}`,
    {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({
        step: params.step,
        provider: params.provider,
        name: params.name,
        description: params.description,
      }),
    },
    (payload) => eventDraftResponseSchema.parse(payload),
  );
  return result.draft;
};

export const deleteDraft = async (draftId: string): Promise<void> => {
  const token = requireToken();
  await callApi(
    `/v1/playlists/drafts/${encodeURIComponent(draftId)}`,
    { method: 'DELETE', headers: { authorization: `Bearer ${token}` } },
    (payload) => deleteEventDraftResponseSchema.parse(payload),
  );
};

export const createEvent = async (params: {
  provider: 'spotify' | 'apple';
  name: string;
  description: string;
  draftId: string | null;
}): Promise<{ eventId: string; magicLinkToken: string; magicLinkUrl: string }> => {
  const token = requireToken();
  const result = await callApi(
    '/v1/playlists',
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({
        provider: params.provider,
        name: params.name,
        description: params.description,
        draftId: params.draftId ?? undefined,
      }),
    },
    (payload) => eventResponseSchema.parse(payload),
  );
  return {
    eventId: result.event.id,
    magicLinkToken: result.event.magicLinkToken,
    magicLinkUrl: result.magicLinkUrl,
  };
};

// ---------------------------------------------------------------------------
// Provider (integration) mutations
// ---------------------------------------------------------------------------

export const disconnectProvider = async (provider: 'spotify' | 'apple'): Promise<void> => {
  const token = requireToken();
  await callApi(
    `/v1/auth/${provider}/disconnect`,
    { method: 'POST', headers: { authorization: `Bearer ${token}` } },
    (payload) => integrationDisconnectResponseSchema.parse(payload),
  );
};

export const connectAppleToBackend = async (musicUserToken: string): Promise<void> => {
  const token = requireToken();
  await callApi(
    '/v1/auth/apple/connect',
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({ musicUserToken }),
    },
    (payload) => oauthCallbackResponseSchema.parse(payload),
  );
};

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

export const fetchUserPreferences = async (): Promise<UserPreferences> => {
  const token = requireToken();
  const result = await callApi(
    '/v1/auth/preferences',
    { method: 'GET', headers: { authorization: `Bearer ${token}` } },
    (payload) => userPreferencesResponseSchema.parse(payload),
  );
  return result.preferences;
};

export const updateUserPreferences = async (
  patch: Partial<UserPreferences>,
): Promise<UserPreferences> => {
  const token = requireToken();
  const result = await callApi(
    '/v1/auth/preferences',
    {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify(patch),
    },
    (payload) => userPreferencesResponseSchema.parse(payload),
  );
  return result.preferences;
};

export type { UserPreferences };

// ---------------------------------------------------------------------------
// Sync query keys
// ---------------------------------------------------------------------------

export const syncQueryKeys = {
  all: () => ['syncs'] as const,
  list: () => ['syncs', 'list'] as const,
  ownedList: () => ['syncs', 'ownedList'] as const,
  detail: (syncId: string) => ['syncs', 'detail', syncId] as const,
  public: (token: string) => ['syncs', 'public', token] as const,
  providerPlaylists: (provider: string, offset: number) =>
    ['syncs', 'providerPlaylists', provider, offset] as const,
  providerPlaylistTrackCount: (provider: string, providerPlaylistId: string) =>
    ['syncs', 'providerPlaylistTrackCount', provider, providerPlaylistId] as const,
};

// ---------------------------------------------------------------------------
// Sync fetchers
// ---------------------------------------------------------------------------

export const fetchSyncs = async (): Promise<SyncItem[]> => {
  const token = requireToken();
  const result = await callApi(
    '/v1/syncs',
    { method: 'GET', headers: { authorization: `Bearer ${token}` } },
    (payload) => syncListResponseSchema.parse(payload),
  );
  return result.ownedSyncs;
};

export const fetchSyncCollections = async (): Promise<{
  ownedSyncs: SyncItem[];
  subscribedSyncs: SyncItem[];
}> => {
  const token = requireToken();
  return callApi(
    '/v1/syncs',
    { method: 'GET', headers: { authorization: `Bearer ${token}` } },
    (payload) => syncListResponseSchema.parse(payload),
  );
};

export const fetchSyncDetail = async (syncId: string): Promise<SyncDetailItem> => {
  const token = requireToken();
  const result = await callApi(
    `/v1/syncs/${encodeURIComponent(syncId)}`,
    { method: 'GET', headers: { authorization: `Bearer ${token}` } },
    (payload) => syncDetailResponseSchema.parse(payload),
  );
  return result.sync;
};

export const fetchSyncPublic = async (magicLinkToken: string): Promise<SyncPublicItem> => {
  const accessToken = getAccessToken();
  const result = await callApi(
    `/v1/syncs/link/${encodeURIComponent(magicLinkToken)}`,
    {
      method: 'GET',
      headers: accessToken ? { authorization: `Bearer ${accessToken}` } : undefined,
    },
    (payload) => syncPublicResponseSchema.parse(payload),
  );
  return result.sync;
};

export const fetchDashboardSummary = async (): Promise<DashboardSummaryResponse> => {
  const token = requireToken();
  return callApi(
    '/v1/dashboard/summary',
    { method: 'GET', headers: { authorization: `Bearer ${token}` } },
    (payload) => dashboardSummaryResponseSchema.parse(payload),
  );
};

export const trackEvent = async (
  magicLinkToken: string,
): Promise<{ ok: true; trackedAt: string | null }> => {
  const token = requireToken();
  return callApi(
    `/v1/playlists/link/${encodeURIComponent(magicLinkToken)}/track`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    },
    (payload) => eventTrackingResponseSchema.parse(payload),
  );
};

export const untrackEvent = async (
  magicLinkToken: string,
): Promise<{ ok: true; trackedAt: string | null }> => {
  const token = requireToken();
  return callApi(
    `/v1/playlists/link/${encodeURIComponent(magicLinkToken)}/track`,
    {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    },
    (payload) => eventTrackingResponseSchema.parse(payload),
  );
};

export const fetchProviderPlaylists = async (params: {
  provider: 'spotify' | 'apple';
  limit?: number;
  offset?: number;
}): Promise<{ playlists: ProviderPlaylistItem[]; hasMore: boolean }> => {
  const token = requireToken();
  const url = new URL('/v1/syncs/provider-playlists', 'http://placeholder');
  url.searchParams.set('provider', params.provider);
  url.searchParams.set('limit', String(params.limit ?? 25));
  url.searchParams.set('offset', String(params.offset ?? 0));
  const result = await callApi(
    `/v1/syncs/provider-playlists?${url.searchParams.toString()}`,
    { method: 'GET', headers: { authorization: `Bearer ${token}` } },
    (payload) => providerPlaylistListResponseSchema.parse(payload),
  );
  return result;
};

export const fetchProviderPlaylistTrackCount = async (params: {
  provider: 'spotify' | 'apple';
  providerPlaylistId: string;
}): Promise<number> => {
  const token = requireToken();
  const url = new URL(
    `/v1/syncs/provider-playlists/${encodeURIComponent(params.providerPlaylistId)}/track-count`,
    'http://placeholder',
  );
  url.searchParams.set('provider', params.provider);

  const result = await callApi(
    `${url.pathname}?${url.searchParams.toString()}`,
    { method: 'GET', headers: { authorization: `Bearer ${token}` } },
    (payload) => providerPlaylistTrackCountResponseSchema.parse(payload),
  );
  return result.trackCount;
};

// ---------------------------------------------------------------------------
// Sync mutations
// ---------------------------------------------------------------------------

export const createSync = async (params: {
  provider: 'spotify' | 'apple';
  providerPlaylistId: string;
  name: string;
  trackCount: number | null;
  syncMode: 'host_only' | 'bidirectional';
}): Promise<{ sync: SyncItem; magicLinkUrl: string }> => {
  const token = requireToken();
  const body = createSyncRequestSchema.parse(params);
  const result = await callApi(
    '/v1/syncs',
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    },
    (payload) => syncResponseSchema.parse(payload),
  );
  return result;
};

export const updateSync = async (params: {
  syncId: string;
  syncMode: 'host_only' | 'bidirectional';
}): Promise<{ sync: SyncItem; magicLinkUrl: string }> => {
  const token = requireToken();
  const body = updateSyncRequestSchema.parse({
    syncMode: params.syncMode,
  });
  const result = await callApi(
    `/v1/syncs/${encodeURIComponent(params.syncId)}`,
    {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    },
    (payload) => syncResponseSchema.parse(payload),
  );
  return result;
};

export const revokeSyncMagicLink = async (
  syncId: string,
): Promise<{ sync: SyncItem; magicLinkUrl: string }> => {
  const token = requireToken();
  const result = await callApi(
    `/v1/syncs/${encodeURIComponent(syncId)}/magic-link/revoke`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    },
    (payload) => syncResponseSchema.parse(payload),
  );
  return result;
};

export const regenerateSyncMagicLink = async (
  syncId: string,
): Promise<{ sync: SyncItem; magicLinkUrl: string }> => {
  const token = requireToken();
  const result = await callApi(
    `/v1/syncs/${encodeURIComponent(syncId)}/magic-link/regenerate`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    },
    (payload) => syncResponseSchema.parse(payload),
  );
  return result;
};

export const importSync = async (params: {
  magicLinkToken: string;
  recipientProvider: 'spotify' | 'apple';
}): Promise<ImportSyncResponse> => {
  const token = requireToken();
  const body = importSyncRequestSchema.parse({ recipientProvider: params.recipientProvider });
  const result = await callApi(
    `/v1/syncs/link/${encodeURIComponent(params.magicLinkToken)}/import`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    },
    (payload) => importSyncResponseSchema.parse(payload),
  );
  return result;
};

export const unsubscribeSync = async (magicLinkToken: string): Promise<{ ok: true }> => {
  const token = requireToken();
  return callApi(
    `/v1/syncs/link/${encodeURIComponent(magicLinkToken)}/import`,
    {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    },
    parseOkResponse,
  );
};
