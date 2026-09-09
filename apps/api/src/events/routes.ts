import {
  addEventTrackRequestSchema,
  addEventTrackResponseSchema,
  createEventDraftRequestSchema,
  createEventRequestSchema,
  deleteEventDraftResponseSchema,
  deleteEventResponseSchema,
  eventDraftListResponseSchema,
  eventDraftResponseSchema,
  eventDraftStepSchema,
  eventListResponseSchema,
  eventProvidersResponseSchema,
  eventPublicResponseSchema,
  eventTrackingResponseSchema,
  eventResponseSchema,
  eventTrackSearchResponseSchema,
  eventTracksResponseSchema,
  removeEventTrackResponseSchema,
  updateEventDraftRequestSchema,
  updateEventRequestSchema,
  type Provider,
} from '@synqit/shared';
import { FastifyInstance, FastifyReply } from 'fastify';
import { randomUUID } from 'node:crypto';

import {
  createEventImageReadStream,
  buildEventImageUrl,
  deleteEventImage,
  resolveEventImageFile,
  saveEventImage,
} from './event-image-storage';
import { requireOwnedDraft, requireOwnedEvent } from './guards';
import { eventsStore, EventDraftRecord, EventRecord } from './store';
import { requireAuthenticatedUserId, resolveAuthenticatedUserId } from '../auth/guards';
import { mapProviderApiError } from '../integrations/provider-errors';
import { getProviderAdapter, getProviderLabel } from '../integrations/provider-registry';
import { withSpotifyAccessTokenRetry, IntegrationError } from '../integrations/spotify-client';
import {
  getSpotifyCurrentUser,
  getSpotifyPlaylistSummary,
} from '../integrations/spotify-playlists';
import { ProviderApiError } from '../integrations/spotify-tracks';
import { integrationStore } from '../integrations/store';
import { buildRouteRateLimiters } from '../security/rate-limits';
import { getEventProviders } from '../settings/event-providers';

const DEFAULT_EVENT_LINK_BASE_URL = 'http://127.0.0.1:5173';
const MOCK_TRACKS = [
  {
    providerTrackId: 'mock-track-1',
    name: 'Midnight Drive',
    artist: 'Neon Avenue',
    album: 'City Lights',
    durationMs: 203000,
    artworkUrl: null,
    previewUrl: null,
  },
  {
    providerTrackId: 'mock-track-2',
    name: 'Golden Hour',
    artist: 'Summer Static',
    album: 'Sunset Signals',
    durationMs: 187000,
    artworkUrl: null,
    previewUrl: null,
  },
  {
    providerTrackId: 'mock-track-3',
    name: 'Heartbeat Echo',
    artist: 'Pulse Union',
    album: 'Afterglow',
    durationMs: 221000,
    artworkUrl: null,
    previewUrl: null,
  },
] as const;

const buildEventMagicLinkUrl = (magicLinkToken: string): string => {
  const eventLinkBaseUrl = process.env.EVENT_LINK_BASE_URL ?? DEFAULT_EVENT_LINK_BASE_URL;
  const url = new URL(`/playlist/${magicLinkToken}`, eventLinkBaseUrl);
  return url.toString();
};

const resolveProviderConnectionStatus = async (params: {
  hostUserId: string;
  provider: EventRecord['provider'];
}): Promise<'connected' | 'not_connected'> => {
  const integration = await integrationStore.findIntegration({
    userId: params.hostUserId,
    provider: params.provider,
  });

  return integration ? 'connected' : 'not_connected';
};

const toEventResponse = (params: {
  event: EventRecord;
  providerConnectionStatus: 'connected' | 'not_connected';
}) =>
  eventResponseSchema.parse({
    event: {
      ...params.event,
      coverImageUrl: buildEventImageUrl(params.event.coverImageUrl),
      providerConnectionStatus: params.providerConnectionStatus,
      closeReason: params.event.closeReason ?? null,
      magicLinkRevokedAt: params.event.magicLinkRevokedAt
        ? params.event.magicLinkRevokedAt.toISOString()
        : null,
      createdAt: params.event.createdAt.toISOString(),
      updatedAt: params.event.updatedAt.toISOString(),
      closedAt: params.event.closedAt ? params.event.closedAt.toISOString() : null,
    },
    magicLinkUrl: buildEventMagicLinkUrl(params.event.magicLinkToken),
  });

const toEventDraftResponse = (draft: EventDraftRecord) =>
  eventDraftResponseSchema.parse({
    draft: {
      id: draft.id,
      hostUserId: draft.hostUserId,
      provider: draft.provider,
      name: draft.name,
      description: draft.description,
      step: draft.step,
      createdAt: draft.createdAt.toISOString(),
      updatedAt: draft.updatedAt.toISOString(),
    },
  });

const sendIntegrationError = (reply: FastifyReply, error: IntegrationError) => {
  if (error.code === 'provider_not_connected') {
    return reply.status(400).send({
      code: error.code,
      message: error.message,
    });
  }

  if (
    error.code === 'token_decrypt_failed' ||
    error.code === 'provider_refresh_token_decrypt_failed' ||
    error.code === 'provider_auth_not_configured'
  ) {
    return reply.status(500).send({
      code: error.code,
      message: error.message,
    });
  }

  return reply.status(502).send({
    code: error.code,
    message: error.message,
  });
};

const reconcileMissingProviderPlaylist = async (params: {
  app: FastifyInstance;
  event: EventRecord;
  operation: 'add_track' | 'remove_track' | 'sync_tracks';
  providerTrackId: string;
  providerError: unknown;
  providerStatusCode: number;
  magicLinkToken?: string;
}): Promise<void> => {
  const closedEvent = await eventsStore.closeEvent({
    eventId: params.event.id,
    hostUserId: params.event.hostUserId,
    closeReason: 'provider_playlist_missing',
  });

  params.app.log.warn(
    {
      eventId: params.event.id,
      hostUserId: params.event.hostUserId,
      provider: params.event.provider,
      providerPlaylistId: params.event.providerPlaylistId,
      providerTrackId: params.providerTrackId,
      providerStatusCode: params.providerStatusCode,
      providerError: params.providerError,
      magicLinkToken: params.magicLinkToken ?? null,
      operation: params.operation,
      eventClosed: Boolean(closedEvent),
    },
    'provider playlist missing; event reconciled as closed',
  );
};

type ProviderOperation = 'create_playlist' | 'search' | 'add_track' | 'remove_track';

const PROVIDER_FAILURE_CODES: Record<ProviderOperation, string> = {
  create_playlist: 'provider_playlist_create_failed',
  search: 'provider_search_failed',
  add_track: 'provider_add_track_failed',
  remove_track: 'provider_remove_track_failed',
};

const PROVIDER_FAILURE_LOG_MESSAGES: Record<ProviderOperation, string> = {
  create_playlist: 'provider create playlist failed',
  search: 'provider track search failed',
  add_track: 'provider add track failed',
  remove_track: 'provider remove track failed',
};

/**
 * One error path for every provider call an event makes, whichever service is
 * behind it. Integration errors (not connected, undecryptable token) keep their
 * own statuses; a 404 on a playlist write closes the event, because the playlist
 * is gone; everything else goes through the shared provider error table with
 * the service's name in the copy.
 */
const replyProviderFailure = async (params: {
  app: FastifyInstance;
  reply: FastifyReply;
  error: unknown;
  operation: ProviderOperation;
  provider: Provider;
  event?: EventRecord;
  providerTrackId?: string;
  magicLinkToken?: string;
  logContext?: Record<string, unknown>;
}) => {
  const { app, reply, error, operation, event } = params;
  if (error instanceof IntegrationError) {
    return sendIntegrationError(reply, error);
  }

  const label = getProviderLabel(params.provider);
  if (error instanceof ProviderApiError) {
    app.log.warn(
      {
        provider: error.provider,
        providerStatusCode: error.statusCode,
        providerError: error.details,
        eventId: event?.id,
        magicLinkToken: params.magicLinkToken,
        providerPlaylistId: event?.providerPlaylistId,
        providerTrackId: params.providerTrackId,
        ...params.logContext,
      },
      PROVIDER_FAILURE_LOG_MESSAGES[operation],
    );

    if (
      error.statusCode === 404 &&
      event &&
      (operation === 'add_track' || operation === 'remove_track')
    ) {
      await reconcileMissingProviderPlaylist({
        app,
        event,
        operation,
        providerTrackId: params.providerTrackId ?? '*',
        providerStatusCode: error.statusCode,
        providerError: error.details,
        magicLinkToken: params.magicLinkToken,
      });

      return reply.status(409).send({
        code: 'provider_playlist_missing',
        message: `The linked ${label} playlist no longer exists. This event was closed. Ask the host to create a new event.`,
      });
    }

    const mapped = mapProviderApiError(error, {
      500: {
        code: 'provider_playlist_update_failed',
        message: `${label} could not update this playlist right now. Please try again in a moment.`,
      },
      ...(operation === 'add_track'
        ? {
            403: {
              code: 'provider_forbidden',
              message: `${label} denied this track add. Try a different track; if it still fails, reconnect ${label} and create a new event.`,
            },
          }
        : {}),
      ...(operation === 'remove_track'
        ? {
            403: {
              code: 'provider_forbidden',
              message: `${label} denied track removal for this playlist.`,
            },
          }
        : {}),
      // Apple Music sometimes answers a removal with a 401 that a reconnect does
      // not clear straight away; say so rather than sending the host in circles.
      ...(operation === 'remove_track' && params.provider === 'apple'
        ? {
            401: {
              code: 'provider_remove_track_temporarily_unavailable',
              message:
                'Apple Music rejected track removal for this connected account. Reconnect may not resolve it immediately; try again later.',
            },
          }
        : {}),
    });
    return reply.status(502).send(mapped);
  }

  const message = error instanceof Error ? error.message : 'Provider API error.';
  return reply.status(502).send({
    code: PROVIDER_FAILURE_CODES[operation],
    message,
  });
};

/**
 * Spotify refuses playlist writes with a bare 403 for two very different
 * reasons: the playlist belongs to another account, or the token lacks the
 * modify scope. Both end in "reconnect", but the message has to say which.
 * Spotify-only, since no other service reports permission problems this
 * indirectly; every other provider goes straight to the shared mapping.
 */
const diagnoseSpotifyForbiddenAdd = async (params: {
  app: FastifyInstance;
  event: EventRecord;
  integrationScopes: string[];
}): Promise<{ code: string; message: string } | null> => {
  const { app, event } = params;
  try {
    const { result } = await withSpotifyAccessTokenRetry({
      userId: event.hostUserId,
      run: (accessToken) =>
        Promise.all([
          getSpotifyCurrentUser({ accessToken }),
          getSpotifyPlaylistSummary({ accessToken, providerPlaylistId: event.providerPlaylistId }),
        ]),
    });
    const [currentUser, playlist] = result;

    app.log.warn(
      {
        eventId: event.id,
        hostUserId: event.hostUserId,
        providerPlaylistId: event.providerPlaylistId,
        spotifyCurrentUserId: currentUser.id,
        spotifyPlaylistOwnerId: playlist.ownerId,
        spotifyPlaylistPublic: playlist.isPublic,
        spotifyPlaylistCollaborative: playlist.collaborative,
        integrationScopes: params.integrationScopes,
      },
      'provider add track forbidden diagnostics',
    );

    if (playlist.ownerId !== currentUser.id && !playlist.collaborative) {
      return {
        code: 'provider_playlist_owner_mismatch',
        message:
          'Spotify playlist is owned by a different account than the connected host. Reconnect host Spotify and create a new event.',
      };
    }

    const requiredScope = playlist.isPublic ? 'playlist-modify-public' : 'playlist-modify-private';
    if (!params.integrationScopes.includes(requiredScope)) {
      return {
        code: 'provider_scope_missing',
        message: `Spotify token is missing required scope: ${requiredScope}. Reconnect Spotify and approve all requested scopes.`,
      };
    }
  } catch (diagnosticsError) {
    app.log.warn(
      {
        eventId: event.id,
        providerPlaylistId: event.providerPlaylistId,
        diagnosticsError:
          diagnosticsError instanceof Error
            ? diagnosticsError.message
            : 'Unknown diagnostics failure.',
      },
      'provider add track diagnostics lookup failed',
    );
  }
  return null;
};

/**
 * Without credentials an event still runs end to end against fixtures. Spotify
 * keeps its historical id shape; the others carry their name so a stray mock id
 * in the database says where it came from.
 */
const buildMockPlaylistId = (provider: Provider): string =>
  provider === 'spotify'
    ? `mock-playlist-${randomUUID()}`
    : `${provider}-mock-playlist-${randomUUID()}`;

const requireActiveMagicLinkEvent = async (
  reply: FastifyReply,
  magicLinkToken: string,
): Promise<EventRecord | null> => {
  const event = await eventsStore.findEventByMagicLinkToken(magicLinkToken);
  if (!event) {
    reply.status(404).send({
      code: 'event_not_found',
      message: 'No playlist found for this link.',
    });
    return null;
  }

  if (event.magicLinkRevokedAt) {
    reply.status(410).send({
      code: 'magic_link_revoked',
      message: 'This magic link has been revoked by the host.',
    });
    return null;
  }

  return event;
};

type ProviderPlaylistTrack = {
  providerTrackId: string;
  name: string;
  artist: string;
  album: string;
  durationMs: number;
  artworkUrl: string | null;
};

const PROVIDER_SYNC_ADDED_BY = 'provider_sync';

const listProviderPlaylistTracks = async (params: {
  app: FastifyInstance;
  event: EventRecord;
  magicLinkToken?: string;
}): Promise<ProviderPlaylistTrack[] | null> => {
  const adapter = getProviderAdapter(params.event.provider);
  if (!adapter.isLiveMode()) {
    return null;
  }

  try {
    return await adapter.listPlaylistTracks({
      userId: params.event.hostUserId,
      providerPlaylistId: params.event.providerPlaylistId,
    });
  } catch (error) {
    const context = {
      eventId: params.event.id,
      hostUserId: params.event.hostUserId,
      provider: params.event.provider,
      providerPlaylistId: params.event.providerPlaylistId,
      magicLinkToken: params.magicLinkToken ?? null,
    };

    if (error instanceof IntegrationError) {
      params.app.log.warn(
        { ...context, integrationErrorCode: error.code, integrationErrorMessage: error.message },
        'provider track sync skipped due integration error',
      );
      return null;
    }

    if (error instanceof ProviderApiError) {
      params.app.log.warn(
        { ...context, providerStatusCode: error.statusCode, providerError: error.details },
        'provider track sync failed',
      );

      if (error.statusCode === 404) {
        await reconcileMissingProviderPlaylist({
          app: params.app,
          event: params.event,
          operation: 'sync_tracks',
          providerTrackId: '*',
          providerStatusCode: error.statusCode,
          providerError: error.details,
          magicLinkToken: params.magicLinkToken,
        });
      }
    }

    return null;
  }
};

const syncEventTracksFromProvider = async (params: {
  app: FastifyInstance;
  event: EventRecord;
  magicLinkToken?: string;
}): Promise<void> => {
  const providerTracks = await listProviderPlaylistTracks(params);
  if (!providerTracks) {
    return;
  }

  const localTracks = await eventsStore.listTracksByEventId(params.event.id);
  const providerTracksById = new Map<string, ProviderPlaylistTrack>();
  for (const track of providerTracks) {
    if (!providerTracksById.has(track.providerTrackId)) {
      providerTracksById.set(track.providerTrackId, track);
    }
  }

  const localTrackIds = new Set(localTracks.map((track) => track.providerTrackId));
  let syncedAddedCount = 0;
  let syncedRemovedCount = 0;

  for (const track of providerTracksById.values()) {
    if (localTrackIds.has(track.providerTrackId)) {
      continue;
    }

    const addedTrack = await eventsStore.addTrackToEvent({
      eventId: params.event.id,
      providerTrackId: track.providerTrackId,
      name: track.name,
      artist: track.artist,
      album: track.album,
      durationMs: track.durationMs,
      artworkUrl: track.artworkUrl,
      addedBy: PROVIDER_SYNC_ADDED_BY,
    });

    if (addedTrack) {
      syncedAddedCount += 1;
    }
  }

  const providerTrackIds = new Set(providerTracksById.keys());
  for (const localTrack of localTracks) {
    if (providerTrackIds.has(localTrack.providerTrackId)) {
      continue;
    }

    const removedTrack = await eventsStore.removeTrackFromEvent({
      eventId: params.event.id,
      providerTrackId: localTrack.providerTrackId,
    });
    if (removedTrack) {
      syncedRemovedCount += 1;
    }
  }

  if (syncedAddedCount > 0 || syncedRemovedCount > 0) {
    params.app.log.info(
      {
        eventId: params.event.id,
        hostUserId: params.event.hostUserId,
        provider: params.event.provider,
        providerPlaylistId: params.event.providerPlaylistId,
        magicLinkToken: params.magicLinkToken ?? null,
        syncedAddedCount,
        syncedRemovedCount,
      },
      'event tracks synchronized from provider playlist',
    );
  }
};

export const registerEventRoutes = async (app: FastifyInstance): Promise<void> => {
  const limiters = buildRouteRateLimiters();

  app.get('/playlists/drafts', async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply);
    if (!userId) return;

    const drafts = await eventsStore.listDraftsByHost(userId);
    return eventDraftListResponseSchema.parse({
      drafts: drafts.map((draft) => ({
        id: draft.id,
        hostUserId: draft.hostUserId,
        provider: draft.provider,
        name: draft.name,
        description: draft.description,
        step: draft.step,
        createdAt: draft.createdAt.toISOString(),
        updatedAt: draft.updatedAt.toISOString(),
      })),
    });
  });

  app.get('/playlists/drafts/:draftId', async (request, reply) => {
    const draftId = (request.params as { draftId?: string }).draftId ?? '';
    if (!draftId) {
      return reply.status(400).send({
        code: 'validation_error',
        message: 'Draft id is required.',
      });
    }

    const ownedDraft = await requireOwnedDraft({ request, reply, draftId });
    if (!ownedDraft) return;

    return toEventDraftResponse(ownedDraft.draft);
  });

  app.post('/playlists/drafts', async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply);
    if (!userId) return;

    const parsedBody = createEventDraftRequestSchema.safeParse(request.body ?? {});
    if (!parsedBody.success) {
      return reply.status(400).send({
        code: 'validation_error',
        message: 'Draft payload is invalid.',
        details: parsedBody.error.flatten(),
      });
    }

    const draft = await eventsStore.createDraft({
      hostUserId: userId,
      provider: parsedBody.data.provider ?? null,
      name: parsedBody.data.name?.trim() ?? '',
      description: parsedBody.data.description ?? '',
      step: eventDraftStepSchema.parse(parsedBody.data.step ?? 1),
    });

    return toEventDraftResponse(draft);
  });

  app.patch('/playlists/drafts/:draftId', async (request, reply) => {
    const draftId = (request.params as { draftId?: string }).draftId ?? '';
    if (!draftId) {
      return reply.status(400).send({
        code: 'validation_error',
        message: 'Draft id is required.',
      });
    }

    const parsedBody = updateEventDraftRequestSchema.safeParse(request.body ?? {});
    if (!parsedBody.success) {
      return reply.status(400).send({
        code: 'validation_error',
        message: 'Draft payload is invalid.',
        details: parsedBody.error.flatten(),
      });
    }

    const ownedDraft = await requireOwnedDraft({ request, reply, draftId });
    if (!ownedDraft) return;
    const draft = await eventsStore.updateDraft({
      draftId,
      hostUserId: ownedDraft.userId,
      provider: parsedBody.data.provider,
      name: parsedBody.data.name?.trim(),
      description: parsedBody.data.description,
      step: parsedBody.data.step,
    });
    if (!draft) {
      return reply.status(404).send({
        code: 'not_found',
        message: 'Draft not found.',
      });
    }

    return toEventDraftResponse(draft);
  });

  app.delete('/playlists/drafts/:draftId', async (request, reply) => {
    const draftId = (request.params as { draftId?: string }).draftId ?? '';
    if (!draftId) {
      return reply.status(400).send({
        code: 'validation_error',
        message: 'Draft id is required.',
      });
    }

    const ownedDraft = await requireOwnedDraft({ request, reply, draftId });
    if (!ownedDraft) return;
    await eventsStore.deleteDraft({ draftId, hostUserId: ownedDraft.userId });

    return deleteEventDraftResponseSchema.parse({
      ok: true,
      id: draftId,
    });
  });

  app.post('/playlists', async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply);
    if (!userId) return;

    const parsedBody = createEventRequestSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.status(400).send({
        code: 'validation_error',
        message: 'Playlist payload is invalid.',
        details: parsedBody.error.flatten(),
      });
    }

    const selectedProvider = parsedBody.data.provider;
    // Hosting is switched on per service by an operator, because guest search is
    // where API quota goes: a service can be connectable and syncable while its
    // quota or OAuth review cannot yet take a party's worth of searches.
    if (!(await getEventProviders()).includes(selectedProvider)) {
      return reply.status(400).send({
        code: 'provider_not_supported_for_events',
        message: `${getProviderLabel(selectedProvider)} cannot host an event playlist yet.`,
      });
    }

    const integration = await integrationStore.findIntegration({
      userId,
      provider: selectedProvider,
    });
    if (!integration) {
      return reply.status(400).send({
        code: 'provider_not_connected',
        message: `Connect ${selectedProvider} before creating an event.`,
      });
    }

    const adapter = getProviderAdapter(selectedProvider);
    let providerPlaylistId: string;
    if (adapter.isLiveMode()) {
      try {
        providerPlaylistId = await adapter.createPlaylist({
          userId,
          name: parsedBody.data.name,
          description: parsedBody.data.description,
        });
      } catch (error) {
        return replyProviderFailure({
          app,
          reply,
          error,
          operation: 'create_playlist',
          provider: selectedProvider,
          logContext: { userId },
        });
      }
    } else {
      providerPlaylistId = buildMockPlaylistId(selectedProvider);
    }

    const event = await eventsStore.createEvent({
      hostUserId: userId,
      provider: selectedProvider,
      providerPlaylistId,
      name: parsedBody.data.name,
      description: parsedBody.data.description,
    });

    if (parsedBody.data.draftId) {
      await eventsStore.deleteDraft({
        draftId: parsedBody.data.draftId,
        hostUserId: userId,
      });
    }

    const providerConnectionStatus = await resolveProviderConnectionStatus({
      hostUserId: event.hostUserId,
      provider: event.provider,
    });

    return toEventResponse({
      event,
      providerConnectionStatus,
    });
  });

  app.get('/playlists', async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply);
    if (!userId) return;

    const [events, integrations] = await Promise.all([
      eventsStore.listEventsByHost(userId),
      integrationStore.listIntegrationsByUser(userId),
    ]);
    const connectedProviders = new Set(integrations.map((integration) => integration.provider));

    return eventListResponseSchema.parse({
      events: events.map((event) => ({
        ...event,
        providerConnectionStatus: connectedProviders.has(event.provider)
          ? 'connected'
          : 'not_connected',
        closeReason: event.closeReason ?? null,
        magicLinkRevokedAt: event.magicLinkRevokedAt
          ? event.magicLinkRevokedAt.toISOString()
          : null,
        createdAt: event.createdAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
        closedAt: event.closedAt ? event.closedAt.toISOString() : null,
      })),
    });
  });

  // Services a host may pick when creating an event: an operator setting rather
  // than a constant, see settings/event-providers.ts.
  app.get('/playlists/providers', async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply);
    if (!userId) return;

    return eventProvidersResponseSchema.parse({ providers: await getEventProviders() });
  });

  app.get('/playlists/link/:magicLinkToken', async (request, reply) => {
    const magicLinkToken = (request.params as { magicLinkToken?: string }).magicLinkToken ?? '';
    const event = await requireActiveMagicLinkEvent(reply, magicLinkToken);
    if (!event) {
      return;
    }

    const viewerUserId = await resolveAuthenticatedUserId(request);

    const providerConnectionStatus = await resolveProviderConnectionStatus({
      hostUserId: event.hostUserId,
      provider: event.provider,
    });

    const isOwner = viewerUserId === event.hostUserId;
    if (viewerUserId && !isOwner) {
      await eventsStore.recordEventVisit({ eventId: event.id, userId: viewerUserId });
    }
    const isTracked =
      viewerUserId && !isOwner
        ? await eventsStore.isTrackedByUser({ eventId: event.id, userId: viewerUserId })
        : false;

    return eventPublicResponseSchema.parse({
      event: {
        id: event.id,
        provider: event.provider,
        providerConnectionStatus,
        status: event.status,
        closeReason: event.closeReason ?? null,
        name: event.name,
        description: event.description,
        coverImageUrl: buildEventImageUrl(event.coverImageUrl),
        createdAt: event.createdAt.toISOString(),
        isOwner,
        isTracked,
      },
    });
  });

  app.post(
    '/playlists/link/:magicLinkToken/track',
    { preHandler: limiters.publicWrite },
    async (request, reply) => {
      const userId = await requireAuthenticatedUserId(request, reply);
      if (!userId) {
        return;
      }

      const magicLinkToken = (request.params as { magicLinkToken?: string }).magicLinkToken ?? '';
      const event = await requireActiveMagicLinkEvent(reply, magicLinkToken);
      if (!event) {
        return;
      }

      if (event.hostUserId === userId) {
        return reply.status(409).send({
          code: 'owner_cannot_track_event',
          message: 'Hosts already manage this playlist and cannot track it as a guest.',
        });
      }

      const tracked = await eventsStore.trackEvent({
        eventId: event.id,
        userId,
      });

      return reply.send(
        eventTrackingResponseSchema.parse({
          ok: true,
          trackedAt: tracked.updatedAt.toISOString(),
        }),
      );
    },
  );

  app.delete(
    '/playlists/link/:magicLinkToken/track',
    { preHandler: limiters.publicWrite },
    async (request, reply) => {
      const userId = await requireAuthenticatedUserId(request, reply);
      if (!userId) {
        return;
      }

      const magicLinkToken = (request.params as { magicLinkToken?: string }).magicLinkToken ?? '';
      const event = await requireActiveMagicLinkEvent(reply, magicLinkToken);
      if (!event) {
        return;
      }

      if (event.hostUserId === userId) {
        return reply.status(409).send({
          code: 'owner_cannot_track_event',
          message: 'Hosts already manage this playlist and cannot track it as a guest.',
        });
      }

      await eventsStore.untrackEvent({
        eventId: event.id,
        userId,
      });

      return reply.send(
        eventTrackingResponseSchema.parse({
          ok: true,
          trackedAt: null,
        }),
      );
    },
  );

  app.get('/playlists/link/:magicLinkToken/tracks', async (request, reply) => {
    const magicLinkToken = (request.params as { magicLinkToken?: string }).magicLinkToken ?? '';
    const event = await requireActiveMagicLinkEvent(reply, magicLinkToken);
    if (!event) {
      return;
    }

    await syncEventTracksFromProvider({
      app,
      event,
      magicLinkToken,
    });

    const tracks = await eventsStore.listTracksByEventId(event.id);
    return eventTracksResponseSchema.parse({
      tracks: tracks.map((track) => ({
        ...track,
        addedAt: track.addedAt.toISOString(),
      })),
    });
  });

  app.get('/playlists/link/:magicLinkToken/search', async (request, reply) => {
    const magicLinkToken = (request.params as { magicLinkToken?: string }).magicLinkToken ?? '';
    const event = await requireActiveMagicLinkEvent(reply, magicLinkToken);
    if (!event) {
      return;
    }

    if (event.status !== 'open') {
      return reply.status(409).send({
        code: 'event_closed',
        message: 'This playlist is closed and no longer accepts new tracks.',
      });
    }

    const requestQuery = request.query as {
      q?: string;
      limit?: string | number;
      offset?: string | number;
    };
    const query = (requestQuery.q ?? '').trim();
    const rawLimit = Number.parseInt(String(requestQuery.limit ?? ''), 10);
    const rawOffset = Number.parseInt(String(requestQuery.offset ?? ''), 10);
    const limit = Number.isNaN(rawLimit) ? 25 : Math.min(Math.max(rawLimit, 1), 25);
    const offset = Number.isNaN(rawOffset) ? 0 : Math.max(rawOffset, 0);

    if (query.length < 2) {
      return reply.status(400).send({
        code: 'validation_error',
        message: 'Search query must be at least 2 characters.',
      });
    }

    const adapter = getProviderAdapter(event.provider);
    if (adapter.isLiveMode()) {
      try {
        const results = await adapter.searchTracks({
          userId: event.hostUserId,
          query,
          limit,
          offset,
        });
        return eventTrackSearchResponseSchema.parse({ results });
      } catch (error) {
        return replyProviderFailure({
          app,
          reply,
          error,
          operation: 'search',
          provider: event.provider,
          event,
          magicLinkToken,
          logContext: { query },
        });
      }
    }

    const normalizedQuery = query.toLowerCase();
    const results = MOCK_TRACKS.filter((track) => {
      const searchable = `${track.name} ${track.artist} ${track.album}`.toLowerCase();
      return searchable.includes(normalizedQuery);
    }).slice(offset, offset + limit);

    return eventTrackSearchResponseSchema.parse({
      results,
    });
  });

  app.post(
    '/playlists/link/:magicLinkToken/tracks',
    { preHandler: limiters.publicWrite },
    async (request, reply) => {
      const magicLinkToken = (request.params as { magicLinkToken?: string }).magicLinkToken ?? '';
      const event = await requireActiveMagicLinkEvent(reply, magicLinkToken);
      if (!event) {
        return;
      }

      if (event.status !== 'open') {
        return reply.status(409).send({
          code: 'event_closed',
          message: 'This playlist is closed and no longer accepts new tracks.',
        });
      }

      const parsedBody = addEventTrackRequestSchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.status(400).send({
          code: 'validation_error',
          message: 'Track payload is invalid.',
          details: parsedBody.error.flatten(),
        });
      }

      if (
        await eventsStore.hasTrack({
          eventId: event.id,
          providerTrackId: parsedBody.data.providerTrackId,
        })
      ) {
        return reply.status(409).send({
          code: 'duplicate_track',
          message: 'Track is already in this playlist.',
        });
      }

      const integration = await integrationStore.findIntegration({
        userId: event.hostUserId,
        provider: event.provider,
      });
      if (!integration) {
        return reply.status(400).send({
          code: 'provider_not_connected',
          message: 'Host provider is not connected.',
        });
      }

      const adapter = getProviderAdapter(event.provider);
      if (adapter.isLiveMode()) {
        try {
          await adapter.addTrack({
            userId: event.hostUserId,
            providerPlaylistId: event.providerPlaylistId,
            providerTrackId: parsedBody.data.providerTrackId,
          });
        } catch (error) {
          if (
            event.provider === 'spotify' &&
            error instanceof ProviderApiError &&
            error.statusCode === 403
          ) {
            const diagnosis = await diagnoseSpotifyForbiddenAdd({
              app,
              event,
              integrationScopes: integration.scopes,
            });
            if (diagnosis) {
              return reply.status(502).send(diagnosis);
            }
          }

          return replyProviderFailure({
            app,
            reply,
            error,
            operation: 'add_track',
            provider: event.provider,
            event,
            providerTrackId: parsedBody.data.providerTrackId,
            magicLinkToken,
          });
        }
      }

      const addedTrack = await eventsStore.addTrackToEvent({
        eventId: event.id,
        providerTrackId: parsedBody.data.providerTrackId,
        name: parsedBody.data.name,
        artist: parsedBody.data.artist,
        album: parsedBody.data.album,
        durationMs: parsedBody.data.durationMs,
        artworkUrl: parsedBody.data.artworkUrl,
        addedBy: 'guest',
      });

      if (!addedTrack) {
        return reply.status(409).send({
          code: 'duplicate_track',
          message: 'Track is already in this playlist.',
        });
      }

      return addEventTrackResponseSchema.parse({
        ok: true,
        track: {
          ...addedTrack,
          addedAt: addedTrack.addedAt.toISOString(),
        },
      });
    },
  );

  app.get('/playlists/:eventId', async (request, reply) => {
    const eventId = (request.params as { eventId?: string }).eventId ?? '';
    const ownedEvent = await requireOwnedEvent({ request, reply, eventId });
    if (!ownedEvent) return;
    let event = ownedEvent.event;

    // Some services let the host rename the playlist in their own app; mirror
    // that back so the event page does not show a stale name. Only adapters that
    // expose playlist details take part, and a failure leaves the stored copy.
    const adapter = getProviderAdapter(event.provider);
    if (adapter.isLiveMode() && adapter.getPlaylistDetails) {
      try {
        const currentEvent = event;
        const details = await adapter.getPlaylistDetails({
          userId: currentEvent.hostUserId,
          providerPlaylistId: currentEvent.providerPlaylistId,
        });
        const nameChanged = details.name !== null && details.name !== event.name;
        const descChanged =
          details.description !== null && details.description !== event.description;
        if (nameChanged || descChanged) {
          const synced = await eventsStore.updateEvent({
            eventId: event.id,
            hostUserId: event.hostUserId,
            name: details.name ?? event.name,
            description: details.description ?? event.description,
          });
          if (synced) event = synced;
        }
      } catch {
        // Non-fatal: fall through and return the DB version
      }
    }

    const providerConnectionStatus = await resolveProviderConnectionStatus({
      hostUserId: event.hostUserId,
      provider: event.provider,
    });

    return toEventResponse({
      event,
      providerConnectionStatus,
    });
  });

  app.get('/playlists/:eventId/tracks', async (request, reply) => {
    const eventId = (request.params as { eventId?: string }).eventId ?? '';
    const ownedEvent = await requireOwnedEvent({ request, reply, eventId });
    if (!ownedEvent) return;
    const event = ownedEvent.event;

    await syncEventTracksFromProvider({
      app,
      event,
    });

    const tracks = await eventsStore.listTracksByEventId(event.id);
    return eventTracksResponseSchema.parse({
      tracks: tracks.map((track) => ({
        ...track,
        addedAt: track.addedAt.toISOString(),
      })),
    });
  });

  app.delete('/playlists/:eventId/tracks/:providerTrackId', async (request, reply) => {
    const eventId = (request.params as { eventId?: string }).eventId ?? '';
    const providerTrackId = (request.params as { providerTrackId?: string }).providerTrackId ?? '';
    const ownedEvent = await requireOwnedEvent({ request, reply, eventId });
    if (!ownedEvent) return;
    const event = ownedEvent.event;

    if (
      !(await eventsStore.hasTrack({
        eventId: event.id,
        providerTrackId,
      }))
    ) {
      return reply.status(404).send({
        code: 'track_not_found',
        message: 'Track not found for this playlist.',
      });
    }

    const adapter = getProviderAdapter(event.provider);
    if (adapter.isLiveMode()) {
      try {
        await adapter.removeTrack({
          userId: event.hostUserId,
          providerPlaylistId: event.providerPlaylistId,
          providerTrackId,
        });
      } catch (error) {
        return replyProviderFailure({
          app,
          reply,
          error,
          operation: 'remove_track',
          provider: event.provider,
          event,
          providerTrackId,
        });
      }
    }

    const removedTrack = await eventsStore.removeTrackFromEvent({
      eventId: event.id,
      providerTrackId,
    });
    if (!removedTrack) {
      return reply.status(404).send({
        code: 'track_not_found',
        message: 'Track not found for this playlist.',
      });
    }

    return removeEventTrackResponseSchema.parse({
      ok: true,
      removed: true,
      providerTrackId,
    });
  });

  app.patch('/playlists/:eventId', async (request, reply) => {
    const parsedBody = updateEventRequestSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.status(400).send({
        code: 'validation_error',
        message: 'Playlist payload is invalid.',
        details: parsedBody.error.flatten(),
      });
    }

    const eventId = (request.params as { eventId?: string }).eventId ?? '';
    const ownedEvent = await requireOwnedEvent({ request, reply, eventId });
    if (!ownedEvent) return;
    const event = await eventsStore.updateEvent({
      eventId,
      hostUserId: ownedEvent.userId,
      name: parsedBody.data.name,
      description: parsedBody.data.description,
    });
    if (!event) {
      return reply.status(404).send({
        code: 'not_found',
        message: 'Playlist not found.',
      });
    }

    const providerConnectionStatus = await resolveProviderConnectionStatus({
      hostUserId: event.hostUserId,
      provider: event.provider,
    });

    return toEventResponse({
      event,
      providerConnectionStatus,
    });
  });

  app.delete('/playlists/:eventId', async (request, reply) => {
    const eventId = (request.params as { eventId?: string }).eventId ?? '';
    const ownedEvent = await requireOwnedEvent({ request, reply, eventId });
    if (!ownedEvent) return;
    await eventsStore.deleteEvent({
      eventId,
      hostUserId: ownedEvent.userId,
    });

    return deleteEventResponseSchema.parse({
      ok: true,
      deleted: true,
      eventId,
    });
  });

  app.post('/playlists/:eventId/close', async (request, reply) => {
    const eventId = (request.params as { eventId?: string }).eventId ?? '';
    const ownedEvent = await requireOwnedEvent({ request, reply, eventId });
    if (!ownedEvent) return;
    const event = await eventsStore.closeEvent({
      eventId,
      hostUserId: ownedEvent.userId,
    });
    if (!event) {
      return reply.status(404).send({
        code: 'not_found',
        message: 'Playlist not found.',
      });
    }

    const providerConnectionStatus = await resolveProviderConnectionStatus({
      hostUserId: event.hostUserId,
      provider: event.provider,
    });

    return toEventResponse({
      event,
      providerConnectionStatus,
    });
  });

  app.post('/playlists/:eventId/reopen', async (request, reply) => {
    const eventId = (request.params as { eventId?: string }).eventId ?? '';
    const ownedEvent = await requireOwnedEvent({ request, reply, eventId });
    if (!ownedEvent) return;
    const event = await eventsStore.reopenEvent({
      eventId,
      hostUserId: ownedEvent.userId,
    });
    if (!event) {
      return reply.status(404).send({
        code: 'not_found',
        message: 'Playlist not found.',
      });
    }

    const providerConnectionStatus = await resolveProviderConnectionStatus({
      hostUserId: event.hostUserId,
      provider: event.provider,
    });

    return toEventResponse({
      event,
      providerConnectionStatus,
    });
  });

  app.post('/playlists/:eventId/magic-link/revoke', async (request, reply) => {
    const eventId = (request.params as { eventId?: string }).eventId ?? '';
    const ownedEvent = await requireOwnedEvent({ request, reply, eventId });
    if (!ownedEvent) return;
    const event = await eventsStore.revokeMagicLink({
      eventId,
      hostUserId: ownedEvent.userId,
    });
    if (!event) {
      return reply.status(404).send({
        code: 'not_found',
        message: 'Playlist not found.',
      });
    }

    const providerConnectionStatus = await resolveProviderConnectionStatus({
      hostUserId: event.hostUserId,
      provider: event.provider,
    });

    return toEventResponse({
      event,
      providerConnectionStatus,
    });
  });

  app.post('/playlists/:eventId/magic-link/regenerate', async (request, reply) => {
    const eventId = (request.params as { eventId?: string }).eventId ?? '';
    const ownedEvent = await requireOwnedEvent({ request, reply, eventId });
    if (!ownedEvent) return;
    const event = await eventsStore.regenerateMagicLink({
      eventId,
      hostUserId: ownedEvent.userId,
    });
    if (!event) {
      return reply.status(404).send({
        code: 'not_found',
        message: 'Playlist not found.',
      });
    }

    const providerConnectionStatus = await resolveProviderConnectionStatus({
      hostUserId: event.hostUserId,
      provider: event.provider,
    });

    return toEventResponse({
      event,
      providerConnectionStatus,
    });
  });

  // ── Cover image upload ──────────────────────────────────────────────────
  app.post('/playlists/:eventId/image', { bodyLimit: 12_000_000 }, async (request, reply) => {
    const eventId = (request.params as { eventId?: string }).eventId ?? '';
    const ownedEvent = await requireOwnedEvent({ request, reply, eventId });
    if (!ownedEvent) return;
    const event = ownedEvent.event;

    const body = request.body as { imageDataUrl?: unknown };
    if (typeof body?.imageDataUrl !== 'string') {
      return reply
        .status(400)
        .send({ code: 'validation_error', message: 'imageDataUrl is required.' });
    }

    // Delete old image if present
    if (event.coverImageUrl) {
      await deleteEventImage(event.coverImageUrl).catch(() => null);
    }

    let imagePath: string;
    try {
      const result = await saveEventImage({ eventId, imageDataUrl: body.imageDataUrl });
      imagePath = result.imagePath;
    } catch {
      return reply
        .status(400)
        .send({ code: 'invalid_image', message: 'Image is invalid or too large.' });
    }

    const updated = await eventsStore.updateEventCoverImage({
      eventId,
      hostUserId: ownedEvent.userId,
      coverImageUrl: imagePath,
    });
    if (!updated) {
      return reply.status(404).send({
        code: 'not_found',
        message: 'Playlist not found.',
      });
    }

    const providerConnectionStatus = await resolveProviderConnectionStatus({
      hostUserId: updated.hostUserId,
      provider: updated.provider,
    });

    return toEventResponse({ event: updated, providerConnectionStatus });
  });

  // ── Cover image delete ──────────────────────────────────────────────────
  app.delete('/playlists/:eventId/image', async (request, reply) => {
    const eventId = (request.params as { eventId?: string }).eventId ?? '';
    const ownedEvent = await requireOwnedEvent({ request, reply, eventId });
    if (!ownedEvent) return;
    const event = ownedEvent.event;

    if (event.coverImageUrl) {
      await deleteEventImage(event.coverImageUrl).catch(() => null);
    }

    const updated = await eventsStore.updateEventCoverImage({
      eventId,
      hostUserId: ownedEvent.userId,
      coverImageUrl: null,
    });
    if (!updated) {
      return reply.status(404).send({
        code: 'not_found',
        message: 'Playlist not found.',
      });
    }

    const providerConnectionStatus = await resolveProviderConnectionStatus({
      hostUserId: updated.hostUserId,
      provider: updated.provider,
    });

    return toEventResponse({ event: updated, providerConnectionStatus });
  });

  // ── Public image serving ────────────────────────────────────────────────
  app.get('/public/event-images/:fileName', async (request, reply) => {
    const fileName = (request.params as { fileName?: string }).fileName ?? '';
    const resolved = await resolveEventImageFile(fileName);
    if (!resolved) {
      return reply.status(404).send({ code: 'not_found', message: 'Image not found.' });
    }

    void reply.header('Content-Type', resolved.contentType);
    void reply.header('Cache-Control', 'public, max-age=31536000, immutable');
    void reply.header('Cross-Origin-Resource-Policy', 'cross-origin');
    return reply.send(createEventImageReadStream(resolved.filePath));
  });
};
