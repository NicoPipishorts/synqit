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
  deleteEventDraftResponseSchema,
  eventDraftListResponseSchema,
  eventDraftResponseSchema,
  eventListResponseSchema,
  eventResponseSchema,
  eventTracksResponseSchema,
  integrationDisconnectResponseSchema,
  integrationListResponseSchema,
  oauthCallbackResponseSchema,
  updateEventRequestSchema,
} from '@synqit/shared';
import type { EventDraft } from '@synqit/shared';

import { callApi } from './api';
import { getAccessToken } from './auth';
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
  provider: HostEvent['provider'];
  providerConnectionStatus: HostEvent['providerConnectionStatus'];
  status: HostEvent['status'];
  magicLinkToken: string;
  magicLinkRevokedAt: string | null;
  updatedAt: string;
}): HostEvent => ({
  id: event.id,
  name: event.name,
  description: event.description,
  provider: event.provider,
  providerConnectionStatus: event.providerConnectionStatus,
  status: event.status,
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

export const closeEvent = async (eventId: string): Promise<HostEvent> => {
  const token = requireToken();
  const result = await callApi(
    `/v1/playlists/${encodeURIComponent(eventId)}/close`,
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
}): Promise<{ eventId: string; magicLinkUrl: string }> => {
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
  return { eventId: result.event.id, magicLinkUrl: result.magicLinkUrl };
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
