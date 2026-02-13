import {
  addEventTrackRequestSchema,
  addEventTrackResponseSchema,
  createEventRequestSchema,
  deleteEventResponseSchema,
  eventListResponseSchema,
  eventPublicResponseSchema,
  eventResponseSchema,
  eventTrackSearchResponseSchema,
  eventTracksResponseSchema,
  type Provider,
  removeEventTrackResponseSchema,
  updateEventRequestSchema,
} from '@synqit/shared';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';

import { eventsStore, EventRecord } from './store';
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
  return userId || null;
};

const buildEventMagicLinkUrl = (magicLinkToken: string): string => {
  const eventLinkBaseUrl = process.env.EVENT_LINK_BASE_URL ?? DEFAULT_EVENT_LINK_BASE_URL;
  const url = new URL(`/event/${magicLinkToken}`, eventLinkBaseUrl);
  return url.toString();
};

const usesSpotifyLiveProvider = (provider: Provider): boolean =>
  provider === 'spotify' && isSpotifyOauthLiveMode();

const toEventResponse = (event: EventRecord) =>
  eventResponseSchema.parse({
    event: {
      ...event,
      magicLinkRevokedAt: event.magicLinkRevokedAt ? event.magicLinkRevokedAt.toISOString() : null,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      closedAt: event.closedAt ? event.closedAt.toISOString() : null,
    },
    magicLinkUrl: buildEventMagicLinkUrl(event.magicLinkToken),
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
    error.code === 'provider_refresh_token_decrypt_failed'
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
  operation: 'add_track' | 'remove_track';
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
      message: 'No event found for this link.',
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

export const registerEventRoutes = async (app: FastifyInstance): Promise<void> => {
  app.post('/events', async (request, reply) => {
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
        message: 'Event payload is invalid.',
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
    if (usesSpotifyLiveProvider(selectedProvider)) {
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
          const mapped = mapProviderApiError(error);
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

    return toEventResponse(event);
  });

  app.get('/events', async (request, reply) => {
    const userId = await verifyAndGetUserId(request);
    if (!userId) {
      return reply.status(401).send({
        code: 'unauthorized',
        message: 'Authentication required.',
      });
    }

    const events = await eventsStore.listEventsByHost(userId);
    return eventListResponseSchema.parse({
      events: events.map((event) => ({
        ...event,
        magicLinkRevokedAt: event.magicLinkRevokedAt
          ? event.magicLinkRevokedAt.toISOString()
          : null,
        createdAt: event.createdAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
        closedAt: event.closedAt ? event.closedAt.toISOString() : null,
      })),
    });
  });

  app.get('/events/link/:magicLinkToken', async (request, reply) => {
    const magicLinkToken = (request.params as { magicLinkToken?: string }).magicLinkToken ?? '';
    const event = await requireActiveMagicLinkEvent(reply, magicLinkToken);
    if (!event) {
      return;
    }

    return eventPublicResponseSchema.parse({
      event: {
        id: event.id,
        provider: event.provider,
        status: event.status,
        name: event.name,
        description: event.description,
        createdAt: event.createdAt.toISOString(),
      },
    });
  });

  app.get('/events/link/:magicLinkToken/tracks', async (request, reply) => {
    const magicLinkToken = (request.params as { magicLinkToken?: string }).magicLinkToken ?? '';
    const event = await requireActiveMagicLinkEvent(reply, magicLinkToken);
    if (!event) {
      return;
    }

    const tracks = await eventsStore.listTracksByEventId(event.id);
    return eventTracksResponseSchema.parse({
      tracks: tracks.map((track) => ({
        ...track,
        addedAt: track.addedAt.toISOString(),
      })),
    });
  });

  app.get('/events/link/:magicLinkToken/search', async (request, reply) => {
    const magicLinkToken = (request.params as { magicLinkToken?: string }).magicLinkToken ?? '';
    const event = await requireActiveMagicLinkEvent(reply, magicLinkToken);
    if (!event) {
      return;
    }

    if (event.status !== 'open') {
      return reply.status(409).send({
        code: 'event_closed',
        message: 'This event is closed and no longer accepts new tracks.',
      });
    }

    const query = ((request.query as { q?: string }).q ?? '').trim();
    if (query.length < 2) {
      return reply.status(400).send({
        code: 'validation_error',
        message: 'Search query must be at least 2 characters.',
      });
    }

    if (!usesSpotifyLiveProvider(event.provider)) {
      const normalizedQuery = query.toLowerCase();
      const results = MOCK_TRACKS.filter((track) => {
        const searchable = `${track.name} ${track.artist} ${track.album}`.toLowerCase();
        return searchable.includes(normalizedQuery);
      });

      return eventTrackSearchResponseSchema.parse({
        results,
      });
    }

    try {
      const response = await withSpotifyAccessTokenRetry({
        userId: event.hostUserId,
        run: (accessToken) =>
          searchSpotifyTracks({
            accessToken,
            query,
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
        const mapped = mapProviderApiError(error);
        return reply.status(502).send(mapped);
      }

      const message = error instanceof Error ? error.message : 'Provider API error.';
      return reply.status(502).send({
        code: 'provider_search_failed',
        message,
      });
    }
  });

  app.post('/events/link/:magicLinkToken/tracks', async (request, reply) => {
    const magicLinkToken = (request.params as { magicLinkToken?: string }).magicLinkToken ?? '';
    const event = await requireActiveMagicLinkEvent(reply, magicLinkToken);
    if (!event) {
      return;
    }

    if (event.status !== 'open') {
      return reply.status(409).send({
        code: 'event_closed',
        message: 'This event is closed and no longer accepts new tracks.',
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

    if (usesSpotifyLiveProvider(event.provider)) {
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

  app.get('/events/:eventId', async (request, reply) => {
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
        message: 'Event not found.',
      });
    }

    return toEventResponse(event);
  });

  app.get('/events/:eventId/tracks', async (request, reply) => {
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
        message: 'Event not found.',
      });
    }

    const tracks = await eventsStore.listTracksByEventId(event.id);
    return eventTracksResponseSchema.parse({
      tracks: tracks.map((track) => ({
        ...track,
        addedAt: track.addedAt.toISOString(),
      })),
    });
  });

  app.delete('/events/:eventId/tracks/:providerTrackId', async (request, reply) => {
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
        message: 'Event not found.',
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
        message: 'Track not found for this event.',
      });
    }

    if (usesSpotifyLiveProvider(event.provider)) {
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

    const removedTrack = await eventsStore.removeTrackFromEvent({
      eventId: event.id,
      providerTrackId,
    });
    if (!removedTrack) {
      return reply.status(404).send({
        code: 'track_not_found',
        message: 'Track not found for this event.',
      });
    }

    return removeEventTrackResponseSchema.parse({
      ok: true,
      removed: true,
      providerTrackId,
    });
  });

  app.patch('/events/:eventId', async (request, reply) => {
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
        message: 'Event payload is invalid.',
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
        message: 'Event not found.',
      });
    }

    return toEventResponse(event);
  });

  app.delete('/events/:eventId', async (request, reply) => {
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
        message: 'Event not found.',
      });
    }

    return deleteEventResponseSchema.parse({
      ok: true,
      deleted: true,
      eventId,
    });
  });

  app.post('/events/:eventId/close', async (request, reply) => {
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
        message: 'Event not found.',
      });
    }

    return toEventResponse(event);
  });

  app.post('/events/:eventId/magic-link/revoke', async (request, reply) => {
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
        message: 'Event not found.',
      });
    }

    return toEventResponse(event);
  });

  app.post('/events/:eventId/magic-link/regenerate', async (request, reply) => {
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
        message: 'Event not found.',
      });
    }

    return toEventResponse(event);
  });
};
