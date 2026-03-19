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
  eventPublicResponseSchema,
  eventResponseSchema,
  eventTrackSearchResponseSchema,
  eventTracksResponseSchema,
  removeEventTrackResponseSchema,
  updateEventDraftRequestSchema,
  updateEventRequestSchema,
} from '@synqit/shared';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';

import {
  createEventImageReadStream,
  buildEventImageUrl,
  deleteEventImage,
  resolveEventImageFile,
  saveEventImage,
} from './event-image-storage';
import { eventsStore, EventDraftRecord, EventRecord } from './store';
import { authStore } from '../auth/store';
import { getAppleStorefront, isAppleLiveMode } from '../integrations/apple';
import { withAppleMusicUserToken } from '../integrations/apple-client';
import {
  addAppleTrackToPlaylist,
  createAppleLibraryPlaylist,
  getAppleUserStorefront,
  listApplePlaylistTracks,
  removeAppleTrackFromPlaylist,
  searchAppleCatalogTracks,
} from '../integrations/apple-music';
import { mapProviderApiError } from '../integrations/provider-errors';
import { isSpotifyOauthLiveMode } from '../integrations/spotify';
import { withSpotifyAccessTokenRetry, IntegrationError } from '../integrations/spotify-client';
import {
  createSpotifyPlaylist,
  getSpotifyCurrentUser,
  getSpotifyPlaylistSummary,
} from '../integrations/spotify-playlists';
import {
  addSpotifyTrackToPlaylist,
  listSpotifyPlaylistTracks,
  ProviderApiError,
  removeSpotifyTrackFromPlaylist,
  searchSpotifyTracks,
} from '../integrations/spotify-tracks';
import { integrationStore } from '../integrations/store';

const DEFAULT_EVENT_LINK_BASE_URL = 'http://127.0.0.1:5173';
const MOCK_TRACKS = [
  {
    providerTrackId: 'mock-track-1',
    name: 'Midnight Drive',
    artist: 'Neon Avenue',
    album: 'City Lights',
    durationMs: 203000,
    artworkUrl: null,
  },
  {
    providerTrackId: 'mock-track-2',
    name: 'Golden Hour',
    artist: 'Summer Static',
    album: 'Sunset Signals',
    durationMs: 187000,
    artworkUrl: null,
  },
  {
    providerTrackId: 'mock-track-3',
    name: 'Heartbeat Echo',
    artist: 'Pulse Union',
    album: 'Afterglow',
    durationMs: 221000,
    artworkUrl: null,
  },
] as const;

const verifyAndGetUserId = async (request: FastifyRequest): Promise<string | null> => {
  try {
    await request.jwtVerify();
  } catch {
    return null;
  }

  if (!request.user || typeof request.user !== 'object' || !('sub' in request.user)) {
    return null;
  }

  const userId = String(request.user.sub);
  if (!userId) {
    return null;
  }

  const user = await authStore.findUserById(userId);
  if (!user || user.isBlocked) {
    return null;
  }

  return userId;
};

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

const findEventForHost = async (params: {
  eventId: string;
  hostUserId: string;
}): Promise<EventRecord | null> => {
  const event = await eventsStore.findEventById(params.eventId);
  if (!event || event.hostUserId !== params.hostUserId) {
    return null;
  }

  return event;
};

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
  if (params.event.provider === 'spotify' && isSpotifyOauthLiveMode()) {
    try {
      const response = await withSpotifyAccessTokenRetry({
        userId: params.event.hostUserId,
        run: (accessToken) =>
          listSpotifyPlaylistTracks({
            accessToken,
            providerPlaylistId: params.event.providerPlaylistId,
          }),
      });

      return response.result;
    } catch (error) {
      if (error instanceof IntegrationError) {
        params.app.log.warn(
          {
            eventId: params.event.id,
            hostUserId: params.event.hostUserId,
            provider: params.event.provider,
            providerPlaylistId: params.event.providerPlaylistId,
            magicLinkToken: params.magicLinkToken ?? null,
            integrationErrorCode: error.code,
            integrationErrorMessage: error.message,
          },
          'provider track sync skipped due integration error',
        );
        return null;
      }

      if (error instanceof ProviderApiError) {
        params.app.log.warn(
          {
            eventId: params.event.id,
            hostUserId: params.event.hostUserId,
            provider: params.event.provider,
            providerPlaylistId: params.event.providerPlaylistId,
            magicLinkToken: params.magicLinkToken ?? null,
            providerStatusCode: error.statusCode,
            providerError: error.details,
          },
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
  }

  if (params.event.provider === 'apple' && isAppleLiveMode()) {
    try {
      const results = await withAppleMusicUserToken({
        userId: params.event.hostUserId,
        run: async ({ developerToken, musicUserToken }) =>
          listApplePlaylistTracks({
            developerToken,
            musicUserToken,
            providerPlaylistId: params.event.providerPlaylistId,
          }),
      });
      return results;
    } catch (error) {
      if (error instanceof IntegrationError) {
        params.app.log.warn(
          {
            eventId: params.event.id,
            hostUserId: params.event.hostUserId,
            provider: params.event.provider,
            providerPlaylistId: params.event.providerPlaylistId,
            magicLinkToken: params.magicLinkToken ?? null,
            integrationErrorCode: error.code,
            integrationErrorMessage: error.message,
          },
          'provider track sync skipped due integration error',
        );
        return null;
      }

      if (error instanceof ProviderApiError) {
        params.app.log.warn(
          {
            eventId: params.event.id,
            hostUserId: params.event.hostUserId,
            provider: params.event.provider,
            providerPlaylistId: params.event.providerPlaylistId,
            magicLinkToken: params.magicLinkToken ?? null,
            providerStatusCode: error.statusCode,
            providerError: error.details,
          },
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
  }

  return null;
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
  app.get('/playlists/drafts', async (request, reply) => {
    const userId = await verifyAndGetUserId(request);
    if (!userId) {
      return reply.status(401).send({
        code: 'unauthorized',
        message: 'Authentication required.',
      });
    }

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
    const userId = await verifyAndGetUserId(request);
    if (!userId) {
      return reply.status(401).send({
        code: 'unauthorized',
        message: 'Authentication required.',
      });
    }

    const draftId = (request.params as { draftId?: string }).draftId ?? '';
    if (!draftId) {
      return reply.status(400).send({
        code: 'validation_error',
        message: 'Draft id is required.',
      });
    }

    const draft = await eventsStore.findDraftById({ draftId, hostUserId: userId });
    if (!draft) {
      return reply.status(404).send({
        code: 'draft_not_found',
        message: 'Draft not found.',
      });
    }

    return toEventDraftResponse(draft);
  });

  app.post('/playlists/drafts', async (request, reply) => {
    const userId = await verifyAndGetUserId(request);
    if (!userId) {
      return reply.status(401).send({
        code: 'unauthorized',
        message: 'Authentication required.',
      });
    }

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
    const userId = await verifyAndGetUserId(request);
    if (!userId) {
      return reply.status(401).send({
        code: 'unauthorized',
        message: 'Authentication required.',
      });
    }

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

    const draft = await eventsStore.updateDraft({
      draftId,
      hostUserId: userId,
      provider: parsedBody.data.provider,
      name: parsedBody.data.name?.trim(),
      description: parsedBody.data.description,
      step: parsedBody.data.step,
    });
    if (!draft) {
      return reply.status(404).send({
        code: 'draft_not_found',
        message: 'Draft not found.',
      });
    }

    return toEventDraftResponse(draft);
  });

  app.delete('/playlists/drafts/:draftId', async (request, reply) => {
    const userId = await verifyAndGetUserId(request);
    if (!userId) {
      return reply.status(401).send({
        code: 'unauthorized',
        message: 'Authentication required.',
      });
    }

    const draftId = (request.params as { draftId?: string }).draftId ?? '';
    if (!draftId) {
      return reply.status(400).send({
        code: 'validation_error',
        message: 'Draft id is required.',
      });
    }

    const deleted = await eventsStore.deleteDraft({ draftId, hostUserId: userId });
    if (!deleted) {
      return reply.status(404).send({
        code: 'draft_not_found',
        message: 'Draft not found.',
      });
    }

    return deleteEventDraftResponseSchema.parse({
      ok: true,
      id: draftId,
    });
  });

  app.post('/playlists', async (request, reply) => {
    const userId = await verifyAndGetUserId(request);
    if (!userId) {
      return reply.status(401).send({
        code: 'unauthorized',
        message: 'Authentication required.',
      });
    }

    const parsedBody = createEventRequestSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.status(400).send({
        code: 'validation_error',
        message: 'Playlist payload is invalid.',
        details: parsedBody.error.flatten(),
      });
    }

    const selectedProvider = parsedBody.data.provider;
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

    let providerPlaylistId: string;
    if (selectedProvider === 'spotify' && isSpotifyOauthLiveMode()) {
      try {
        const createdPlaylist = await withSpotifyAccessTokenRetry({
          userId,
          run: async (accessToken) =>
            createSpotifyPlaylist({
              accessToken,
              name: parsedBody.data.name,
              description: parsedBody.data.description,
            }),
        });
        providerPlaylistId = createdPlaylist.result.providerPlaylistId;
      } catch (error) {
        if (error instanceof IntegrationError) {
          return sendIntegrationError(reply, error);
        }

        if (error instanceof ProviderApiError) {
          app.log.warn(
            {
              provider: error.provider,
              providerStatusCode: error.statusCode,
              providerError: error.details,
              userId,
            },
            'provider create playlist failed',
          );
          const mapped = mapProviderApiError(error, {
            500: {
              code: 'provider_playlist_update_failed',
              message:
                'Apple Music could not update this playlist right now. Please try again in a moment.',
            },
          });
          return reply.status(502).send(mapped);
        }

        const message = error instanceof Error ? error.message : 'Provider API error.';
        return reply.status(502).send({
          code: 'provider_playlist_create_failed',
          message,
        });
      }
    } else if (selectedProvider === 'apple' && isAppleLiveMode()) {
      try {
        providerPlaylistId = await withAppleMusicUserToken({
          userId,
          run: async ({ developerToken, musicUserToken }) => {
            const createdPlaylist = await createAppleLibraryPlaylist({
              developerToken,
              musicUserToken,
              name: parsedBody.data.name,
              description: parsedBody.data.description,
            });
            return createdPlaylist.providerPlaylistId;
          },
        });
      } catch (error) {
        if (error instanceof IntegrationError) {
          return sendIntegrationError(reply, error);
        }

        if (error instanceof ProviderApiError) {
          app.log.warn(
            {
              provider: error.provider,
              providerStatusCode: error.statusCode,
              providerError: error.details,
              userId,
            },
            'provider create playlist failed',
          );
          const mapped = mapProviderApiError(error, {
            500: {
              code: 'provider_playlist_update_failed',
              message:
                'Apple Music could not update this playlist right now. Please try again in a moment.',
            },
          });
          return reply.status(502).send(mapped);
        }

        const message = error instanceof Error ? error.message : 'Provider API error.';
        return reply.status(502).send({
          code: 'provider_playlist_create_failed',
          message,
        });
      }
    } else {
      providerPlaylistId =
        selectedProvider === 'apple'
          ? `apple-mock-playlist-${randomUUID()}`
          : `mock-playlist-${randomUUID()}`;
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
    const userId = await verifyAndGetUserId(request);
    if (!userId) {
      return reply.status(401).send({
        code: 'unauthorized',
        message: 'Authentication required.',
      });
    }

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
        magicLinkRevokedAt: event.magicLinkRevokedAt
          ? event.magicLinkRevokedAt.toISOString()
          : null,
        createdAt: event.createdAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
        closedAt: event.closedAt ? event.closedAt.toISOString() : null,
      })),
    });
  });

  app.get('/playlists/link/:magicLinkToken', async (request, reply) => {
    const magicLinkToken = (request.params as { magicLinkToken?: string }).magicLinkToken ?? '';
    const event = await requireActiveMagicLinkEvent(reply, magicLinkToken);
    if (!event) {
      return;
    }

    const providerConnectionStatus = await resolveProviderConnectionStatus({
      hostUserId: event.hostUserId,
      provider: event.provider,
    });

    return eventPublicResponseSchema.parse({
      event: {
        id: event.id,
        provider: event.provider,
        providerConnectionStatus,
        status: event.status,
        name: event.name,
        description: event.description,
        coverImageUrl: buildEventImageUrl(event.coverImageUrl),
        createdAt: event.createdAt.toISOString(),
      },
    });
  });

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

    if (event.provider === 'spotify' && isSpotifyOauthLiveMode()) {
      try {
        const response = await withSpotifyAccessTokenRetry({
          userId: event.hostUserId,
          run: (accessToken) =>
            searchSpotifyTracks({
              accessToken,
              query,
              limit,
              offset,
            }),
        });

        return eventTrackSearchResponseSchema.parse({
          results: response.result,
        });
      } catch (error) {
        if (error instanceof IntegrationError) {
          return sendIntegrationError(reply, error);
        }

        if (error instanceof ProviderApiError) {
          app.log.warn(
            {
              provider: error.provider,
              providerStatusCode: error.statusCode,
              providerError: error.details,
              eventId: event.id,
              magicLinkToken,
              query,
            },
            'provider track search failed',
          );
          const mapped = mapProviderApiError(error, {
            500: {
              code: 'provider_playlist_update_failed',
              message:
                'Apple Music could not update this playlist right now. Please try again in a moment.',
            },
          });
          return reply.status(502).send(mapped);
        }

        const message = error instanceof Error ? error.message : 'Provider API error.';
        return reply.status(502).send({
          code: 'provider_search_failed',
          message,
        });
      }
    }

    if (event.provider === 'apple' && isAppleLiveMode()) {
      try {
        const results = await withAppleMusicUserToken({
          userId: event.hostUserId,
          run: async ({ developerToken, musicUserToken }) => {
            let storefront = getAppleStorefront();

            try {
              storefront = await getAppleUserStorefront({
                developerToken,
                musicUserToken,
              });
            } catch (error) {
              const fallbackContext = {
                eventId: event.id,
                magicLinkToken,
                hostUserId: event.hostUserId,
                fallbackStorefront: storefront,
              };

              if (error instanceof ProviderApiError) {
                app.log.warn(
                  {
                    ...fallbackContext,
                    provider: error.provider,
                    providerStatusCode: error.statusCode,
                    providerError: error.details,
                  },
                  'apple storefront lookup failed; falling back to configured storefront',
                );
              } else {
                app.log.warn(
                  {
                    ...fallbackContext,
                    errorMessage: error instanceof Error ? error.message : 'Unknown error',
                  },
                  'apple storefront lookup failed; falling back to configured storefront',
                );
              }
            }

            return searchAppleCatalogTracks({
              developerToken,
              storefront,
              query,
              limit,
              offset,
            });
          },
        });

        return eventTrackSearchResponseSchema.parse({
          results,
        });
      } catch (error) {
        if (error instanceof ProviderApiError) {
          app.log.warn(
            {
              provider: error.provider,
              providerStatusCode: error.statusCode,
              providerError: error.details,
              eventId: event.id,
              magicLinkToken,
              query,
            },
            'provider track search failed',
          );
          const mapped = mapProviderApiError(error, {
            500: {
              code: 'provider_playlist_update_failed',
              message:
                'Apple Music could not update this playlist right now. Please try again in a moment.',
            },
          });
          return reply.status(502).send(mapped);
        }

        const message = error instanceof Error ? error.message : 'Provider API error.';
        return reply.status(502).send({
          code: 'provider_search_failed',
          message,
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

  app.post('/playlists/link/:magicLinkToken/tracks', async (request, reply) => {
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

    if (event.provider === 'spotify' && isSpotifyOauthLiveMode()) {
      let providerAccessTokenForDiagnostics: string | null = null;
      try {
        await withSpotifyAccessTokenRetry({
          userId: event.hostUserId,
          run: async (accessToken) => {
            providerAccessTokenForDiagnostics = accessToken;
            await addSpotifyTrackToPlaylist({
              accessToken,
              providerPlaylistId: event.providerPlaylistId,
              providerTrackId: parsedBody.data.providerTrackId,
            });
          },
        });
      } catch (error) {
        if (error instanceof IntegrationError) {
          return sendIntegrationError(reply, error);
        }

        if (error instanceof ProviderApiError) {
          app.log.warn(
            {
              provider: error.provider,
              providerStatusCode: error.statusCode,
              providerError: error.details,
              eventId: event.id,
              magicLinkToken,
              providerPlaylistId: event.providerPlaylistId,
              providerTrackId: parsedBody.data.providerTrackId,
            },
            'provider add track failed',
          );

          if (error.statusCode === 404) {
            await reconcileMissingProviderPlaylist({
              app,
              event,
              operation: 'add_track',
              providerTrackId: parsedBody.data.providerTrackId,
              providerStatusCode: error.statusCode,
              providerError: error.details,
              magicLinkToken,
            });

            return reply.status(409).send({
              code: 'provider_playlist_missing',
              message:
                'The linked Spotify playlist no longer exists. This event was closed. Ask the host to create a new event.',
            });
          }

          if (error.statusCode === 403 && providerAccessTokenForDiagnostics) {
            try {
              const [currentUser, playlist] = await Promise.all([
                getSpotifyCurrentUser({
                  accessToken: providerAccessTokenForDiagnostics,
                }),
                getSpotifyPlaylistSummary({
                  accessToken: providerAccessTokenForDiagnostics,
                  providerPlaylistId: event.providerPlaylistId,
                }),
              ]);

              app.log.warn(
                {
                  eventId: event.id,
                  hostUserId: event.hostUserId,
                  providerPlaylistId: event.providerPlaylistId,
                  spotifyCurrentUserId: currentUser.id,
                  spotifyPlaylistOwnerId: playlist.ownerId,
                  spotifyPlaylistPublic: playlist.isPublic,
                  spotifyPlaylistCollaborative: playlist.collaborative,
                  integrationScopes: integration.scopes,
                },
                'provider add track forbidden diagnostics',
              );

              if (playlist.ownerId !== currentUser.id && !playlist.collaborative) {
                return reply.status(502).send({
                  code: 'provider_playlist_owner_mismatch',
                  message:
                    'Spotify playlist is owned by a different account than the connected host. Reconnect host Spotify and create a new event.',
                });
              }

              const requiredScope = playlist.isPublic
                ? 'playlist-modify-public'
                : 'playlist-modify-private';
              if (!integration.scopes.includes(requiredScope)) {
                return reply.status(502).send({
                  code: 'provider_scope_missing',
                  message: `Spotify token is missing required scope: ${requiredScope}. Reconnect Spotify and approve all requested scopes.`,
                });
              }
            } catch (diagnosticsError) {
              const diagnosticsMessage =
                diagnosticsError instanceof Error
                  ? diagnosticsError.message
                  : 'Unknown diagnostics failure.';
              app.log.warn(
                {
                  eventId: event.id,
                  providerPlaylistId: event.providerPlaylistId,
                  diagnosticsError: diagnosticsMessage,
                },
                'provider add track diagnostics lookup failed',
              );
            }
          }

          const mapped = mapProviderApiError(error, {
            403: {
              code: 'provider_forbidden',
              message:
                'Spotify denied this track add. Try a different track; if it still fails, reconnect Spotify and create a new event.',
            },
          });
          return reply.status(502).send(mapped);
        }

        const message = error instanceof Error ? error.message : 'Provider API error.';
        return reply.status(502).send({
          code: 'provider_add_track_failed',
          message,
        });
      }
    }

    if (event.provider === 'apple' && isAppleLiveMode()) {
      try {
        await withAppleMusicUserToken({
          userId: event.hostUserId,
          run: async ({ developerToken, musicUserToken }) => {
            await addAppleTrackToPlaylist({
              developerToken,
              musicUserToken,
              providerPlaylistId: event.providerPlaylistId,
              providerTrackId: parsedBody.data.providerTrackId,
            });
          },
        });
      } catch (error) {
        if (error instanceof IntegrationError) {
          return sendIntegrationError(reply, error);
        }

        if (error instanceof ProviderApiError) {
          app.log.warn(
            {
              provider: error.provider,
              providerStatusCode: error.statusCode,
              providerError: error.details,
              eventId: event.id,
              magicLinkToken,
              providerPlaylistId: event.providerPlaylistId,
              providerTrackId: parsedBody.data.providerTrackId,
            },
            'provider add track failed',
          );

          if (error.statusCode === 404) {
            await reconcileMissingProviderPlaylist({
              app,
              event,
              operation: 'add_track',
              providerTrackId: parsedBody.data.providerTrackId,
              providerStatusCode: error.statusCode,
              providerError: error.details,
              magicLinkToken,
            });

            return reply.status(409).send({
              code: 'provider_playlist_missing',
              message:
                'The linked provider playlist no longer exists. This event was closed. Ask the host to create a new event.',
            });
          }

          const mapped = mapProviderApiError(error, {
            500: {
              code: 'provider_playlist_update_failed',
              message:
                'Apple Music could not update this playlist right now. Please try again in a moment.',
            },
          });
          return reply.status(502).send(mapped);
        }

        const message = error instanceof Error ? error.message : 'Provider API error.';
        return reply.status(502).send({
          code: 'provider_add_track_failed',
          message,
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
  });

  app.get('/playlists/:eventId', async (request, reply) => {
    const userId = await verifyAndGetUserId(request);
    if (!userId) {
      return reply.status(401).send({
        code: 'unauthorized',
        message: 'Authentication required.',
      });
    }

    const eventId = (request.params as { eventId?: string }).eventId ?? '';
    const event = await findEventForHost({
      eventId,
      hostUserId: userId,
    });
    if (!event) {
      return reply.status(404).send({
        code: 'event_not_found',
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

  app.get('/playlists/:eventId/tracks', async (request, reply) => {
    const userId = await verifyAndGetUserId(request);
    if (!userId) {
      return reply.status(401).send({
        code: 'unauthorized',
        message: 'Authentication required.',
      });
    }

    const eventId = (request.params as { eventId?: string }).eventId ?? '';
    const event = await findEventForHost({
      eventId,
      hostUserId: userId,
    });
    if (!event) {
      return reply.status(404).send({
        code: 'event_not_found',
        message: 'Playlist not found.',
      });
    }

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
    const userId = await verifyAndGetUserId(request);
    if (!userId) {
      return reply.status(401).send({
        code: 'unauthorized',
        message: 'Authentication required.',
      });
    }

    const eventId = (request.params as { eventId?: string }).eventId ?? '';
    const providerTrackId = (request.params as { providerTrackId?: string }).providerTrackId ?? '';
    const event = await findEventForHost({
      eventId,
      hostUserId: userId,
    });
    if (!event) {
      return reply.status(404).send({
        code: 'event_not_found',
        message: 'Playlist not found.',
      });
    }

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

    if (event.provider === 'spotify' && isSpotifyOauthLiveMode()) {
      try {
        await withSpotifyAccessTokenRetry({
          userId: event.hostUserId,
          run: async (accessToken) => {
            await removeSpotifyTrackFromPlaylist({
              accessToken,
              providerPlaylistId: event.providerPlaylistId,
              providerTrackId,
            });
          },
        });
      } catch (error) {
        if (error instanceof IntegrationError) {
          return sendIntegrationError(reply, error);
        }

        if (error instanceof ProviderApiError) {
          app.log.warn(
            {
              provider: error.provider,
              providerStatusCode: error.statusCode,
              providerError: error.details,
              eventId: event.id,
              providerPlaylistId: event.providerPlaylistId,
              providerTrackId,
            },
            'provider remove track failed',
          );

          if (error.statusCode === 404) {
            await reconcileMissingProviderPlaylist({
              app,
              event,
              operation: 'remove_track',
              providerTrackId,
              providerStatusCode: error.statusCode,
              providerError: error.details,
            });

            return reply.status(409).send({
              code: 'provider_playlist_missing',
              message:
                'The linked Spotify playlist no longer exists. This event was closed. Ask the host to create a new event.',
            });
          }

          const mapped = mapProviderApiError(error, {
            403: {
              code: 'provider_forbidden',
              message: 'Spotify denied track removal for this playlist.',
            },
          });
          return reply.status(502).send(mapped);
        }

        const message = error instanceof Error ? error.message : 'Provider API error.';
        return reply.status(502).send({
          code: 'provider_remove_track_failed',
          message,
        });
      }
    }

    if (event.provider === 'apple' && isAppleLiveMode()) {
      try {
        await withAppleMusicUserToken({
          userId: event.hostUserId,
          run: async ({ developerToken, musicUserToken }) => {
            await removeAppleTrackFromPlaylist({
              developerToken,
              musicUserToken,
              providerPlaylistId: event.providerPlaylistId,
              providerTrackId,
            });
          },
        });
      } catch (error) {
        if (error instanceof IntegrationError) {
          return sendIntegrationError(reply, error);
        }

        if (error instanceof ProviderApiError) {
          app.log.warn(
            {
              provider: error.provider,
              providerStatusCode: error.statusCode,
              providerError: error.details,
              eventId: event.id,
              providerPlaylistId: event.providerPlaylistId,
              providerTrackId,
            },
            'provider remove track failed',
          );

          if (error.statusCode === 404) {
            await reconcileMissingProviderPlaylist({
              app,
              event,
              operation: 'remove_track',
              providerTrackId,
              providerStatusCode: error.statusCode,
              providerError: error.details,
            });

            return reply.status(409).send({
              code: 'provider_playlist_missing',
              message:
                'The linked provider playlist no longer exists. This event was closed. Ask the host to create a new event.',
            });
          }

          const mapped = mapProviderApiError(error, {
            401: {
              code: 'provider_remove_track_temporarily_unavailable',
              message:
                'Apple Music rejected track removal for this connected account. Reconnect may not resolve it immediately; try again later.',
            },
          });
          return reply.status(502).send(mapped);
        }

        const message = error instanceof Error ? error.message : 'Provider API error.';
        return reply.status(502).send({
          code: 'provider_remove_track_failed',
          message,
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
    const userId = await verifyAndGetUserId(request);
    if (!userId) {
      return reply.status(401).send({
        code: 'unauthorized',
        message: 'Authentication required.',
      });
    }

    const parsedBody = updateEventRequestSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.status(400).send({
        code: 'validation_error',
        message: 'Playlist payload is invalid.',
        details: parsedBody.error.flatten(),
      });
    }

    const eventId = (request.params as { eventId?: string }).eventId ?? '';
    const event = await eventsStore.updateEvent({
      eventId,
      hostUserId: userId,
      name: parsedBody.data.name,
      description: parsedBody.data.description,
    });
    if (!event) {
      return reply.status(404).send({
        code: 'event_not_found',
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
    const userId = await verifyAndGetUserId(request);
    if (!userId) {
      return reply.status(401).send({
        code: 'unauthorized',
        message: 'Authentication required.',
      });
    }

    const eventId = (request.params as { eventId?: string }).eventId ?? '';
    const deleted = await eventsStore.deleteEvent({
      eventId,
      hostUserId: userId,
    });
    if (!deleted) {
      return reply.status(404).send({
        code: 'event_not_found',
        message: 'Playlist not found.',
      });
    }

    return deleteEventResponseSchema.parse({
      ok: true,
      deleted: true,
      eventId,
    });
  });

  app.post('/playlists/:eventId/close', async (request, reply) => {
    const userId = await verifyAndGetUserId(request);
    if (!userId) {
      return reply.status(401).send({
        code: 'unauthorized',
        message: 'Authentication required.',
      });
    }

    const eventId = (request.params as { eventId?: string }).eventId ?? '';
    const event = await eventsStore.closeEvent({
      eventId,
      hostUserId: userId,
    });
    if (!event) {
      return reply.status(404).send({
        code: 'event_not_found',
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
    const userId = await verifyAndGetUserId(request);
    if (!userId) {
      return reply.status(401).send({
        code: 'unauthorized',
        message: 'Authentication required.',
      });
    }

    const eventId = (request.params as { eventId?: string }).eventId ?? '';
    const event = await eventsStore.reopenEvent({
      eventId,
      hostUserId: userId,
    });
    if (!event) {
      return reply.status(404).send({
        code: 'event_not_found',
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
    const userId = await verifyAndGetUserId(request);
    if (!userId) {
      return reply.status(401).send({
        code: 'unauthorized',
        message: 'Authentication required.',
      });
    }

    const eventId = (request.params as { eventId?: string }).eventId ?? '';
    const event = await eventsStore.revokeMagicLink({
      eventId,
      hostUserId: userId,
    });
    if (!event) {
      return reply.status(404).send({
        code: 'event_not_found',
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
    const userId = await verifyAndGetUserId(request);
    if (!userId) {
      return reply.status(401).send({
        code: 'unauthorized',
        message: 'Authentication required.',
      });
    }

    const eventId = (request.params as { eventId?: string }).eventId ?? '';
    const event = await eventsStore.regenerateMagicLink({
      eventId,
      hostUserId: userId,
    });
    if (!event) {
      return reply.status(404).send({
        code: 'event_not_found',
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
    const userId = await verifyAndGetUserId(request);
    if (!userId) {
      return reply.status(401).send({ code: 'unauthorized', message: 'Authentication required.' });
    }

    const eventId = (request.params as { eventId?: string }).eventId ?? '';
    const event = await eventsStore.findEventById(eventId);
    if (!event || event.hostUserId !== userId) {
      return reply.status(404).send({ code: 'event_not_found', message: 'Playlist not found.' });
    }

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
      hostUserId: userId,
      coverImageUrl: imagePath,
    });
    if (!updated) {
      return reply.status(404).send({ code: 'event_not_found', message: 'Playlist not found.' });
    }

    const providerConnectionStatus = await resolveProviderConnectionStatus({
      hostUserId: updated.hostUserId,
      provider: updated.provider,
    });

    return toEventResponse({ event: updated, providerConnectionStatus });
  });

  // ── Cover image delete ──────────────────────────────────────────────────
  app.delete('/playlists/:eventId/image', async (request, reply) => {
    const userId = await verifyAndGetUserId(request);
    if (!userId) {
      return reply.status(401).send({ code: 'unauthorized', message: 'Authentication required.' });
    }

    const eventId = (request.params as { eventId?: string }).eventId ?? '';
    const event = await eventsStore.findEventById(eventId);
    if (!event || event.hostUserId !== userId) {
      return reply.status(404).send({ code: 'event_not_found', message: 'Playlist not found.' });
    }

    if (event.coverImageUrl) {
      await deleteEventImage(event.coverImageUrl).catch(() => null);
    }

    const updated = await eventsStore.updateEventCoverImage({
      eventId,
      hostUserId: userId,
      coverImageUrl: null,
    });
    if (!updated) {
      return reply.status(404).send({ code: 'event_not_found', message: 'Playlist not found.' });
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
