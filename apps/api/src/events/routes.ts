import {
  addEventTrackRequestSchema,
  addEventTrackResponseSchema,
  createEventRequestSchema,
  eventListResponseSchema,
  eventPublicResponseSchema,
  eventResponseSchema,
  eventTrackSearchResponseSchema,
  eventTracksResponseSchema,
} from '@synqit/shared';
import { FastifyInstance, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';

import { eventsStore, EventRecord } from './store';
import { decryptToken } from '../integrations/crypto';
import { isSpotifyOauthLiveMode } from '../integrations/spotify';
import {
  createSpotifyPlaylist,
  getSpotifyCurrentUser,
  getSpotifyPlaylistSummary,
} from '../integrations/spotify-playlists';
import {
  addSpotifyTrackToPlaylist,
  ProviderApiError,
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

const toEventResponse = (event: EventRecord) =>
  eventResponseSchema.parse({
    event: {
      ...event,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      closedAt: event.closedAt ? event.closedAt.toISOString() : null,
    },
    magicLinkUrl: buildEventMagicLinkUrl(event.magicLinkToken),
  });

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

    const integration = integrationStore.findIntegration({
      userId,
      provider: 'spotify',
    });
    if (!integration) {
      return reply.status(400).send({
        code: 'provider_not_connected',
        message: 'Connect Spotify before creating an event.',
      });
    }

    let providerPlaylistId: string;
    if (isSpotifyOauthLiveMode()) {
      let accessToken: string;
      try {
        accessToken = decryptToken(integration.accessToken);
      } catch {
        return reply.status(500).send({
          code: 'token_decrypt_failed',
          message: 'Stored provider token could not be decrypted.',
        });
      }

      try {
        const createdPlaylist = await createSpotifyPlaylist({
          accessToken,
          name: parsedBody.data.name,
          description: parsedBody.data.description,
        });
        providerPlaylistId = createdPlaylist.providerPlaylistId;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Provider API error.';
        return reply.status(502).send({
          code: 'provider_playlist_create_failed',
          message,
        });
      }
    } else {
      providerPlaylistId = `mock-playlist-${randomUUID()}`;
    }

    const event = eventsStore.createEvent({
      hostUserId: userId,
      provider: 'spotify',
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

    const events = eventsStore.listEventsByHost(userId);
    return eventListResponseSchema.parse({
      events: events.map((event) => ({
        ...event,
        createdAt: event.createdAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
        closedAt: event.closedAt ? event.closedAt.toISOString() : null,
      })),
    });
  });

  app.get('/events/link/:magicLinkToken', async (request, reply) => {
    const magicLinkToken = (request.params as { magicLinkToken?: string }).magicLinkToken ?? '';
    const event = eventsStore.findEventByMagicLinkToken(magicLinkToken);

    if (!event) {
      return reply.status(404).send({
        code: 'event_not_found',
        message: 'No event found for this link.',
      });
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
    const event = eventsStore.findEventByMagicLinkToken(magicLinkToken);

    if (!event) {
      return reply.status(404).send({
        code: 'event_not_found',
        message: 'No event found for this link.',
      });
    }

    const tracks = eventsStore.listTracksByEventId(event.id);
    return eventTracksResponseSchema.parse({
      tracks: tracks.map((track) => ({
        ...track,
        addedAt: track.addedAt.toISOString(),
      })),
    });
  });

  app.get('/events/link/:magicLinkToken/search', async (request, reply) => {
    const magicLinkToken = (request.params as { magicLinkToken?: string }).magicLinkToken ?? '';
    const event = eventsStore.findEventByMagicLinkToken(magicLinkToken);

    if (!event) {
      return reply.status(404).send({
        code: 'event_not_found',
        message: 'No event found for this link.',
      });
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

    const integration = integrationStore.findIntegration({
      userId: event.hostUserId,
      provider: event.provider,
    });
    if (!integration) {
      return reply.status(400).send({
        code: 'provider_not_connected',
        message: 'Host provider is not connected.',
      });
    }

    if (!isSpotifyOauthLiveMode()) {
      const normalizedQuery = query.toLowerCase();
      const results = MOCK_TRACKS.filter((track) => {
        const searchable = `${track.name} ${track.artist} ${track.album}`.toLowerCase();
        return searchable.includes(normalizedQuery);
      });

      return eventTrackSearchResponseSchema.parse({
        results,
      });
    }

    let accessToken: string;
    try {
      accessToken = decryptToken(integration.accessToken);
    } catch {
      return reply.status(500).send({
        code: 'token_decrypt_failed',
        message: 'Stored provider token could not be decrypted.',
      });
    }

    try {
      const results = await searchSpotifyTracks({
        accessToken,
        query,
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

        if (error.statusCode === 401) {
          return reply.status(502).send({
            code: 'provider_token_invalid',
            message: 'Host Spotify session expired. Reconnect Spotify and try again.',
          });
        }
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
    const event = eventsStore.findEventByMagicLinkToken(magicLinkToken);

    if (!event) {
      return reply.status(404).send({
        code: 'event_not_found',
        message: 'No event found for this link.',
      });
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
      eventsStore.hasTrack({
        eventId: event.id,
        providerTrackId: parsedBody.data.providerTrackId,
      })
    ) {
      return reply.status(409).send({
        code: 'duplicate_track',
        message: 'Track is already in this playlist.',
      });
    }

    const integration = integrationStore.findIntegration({
      userId: event.hostUserId,
      provider: event.provider,
    });
    if (!integration) {
      return reply.status(400).send({
        code: 'provider_not_connected',
        message: 'Host provider is not connected.',
      });
    }

    if (isSpotifyOauthLiveMode()) {
      let accessToken: string;
      try {
        accessToken = decryptToken(integration.accessToken);
      } catch {
        return reply.status(500).send({
          code: 'token_decrypt_failed',
          message: 'Stored provider token could not be decrypted.',
        });
      }

      try {
        await addSpotifyTrackToPlaylist({
          accessToken,
          providerPlaylistId: event.providerPlaylistId,
          providerTrackId: parsedBody.data.providerTrackId,
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
              providerPlaylistId: event.providerPlaylistId,
              providerTrackId: parsedBody.data.providerTrackId,
            },
            'provider add track failed',
          );

          if (error.statusCode === 401) {
            return reply.status(502).send({
              code: 'provider_token_invalid',
              message: 'Host Spotify session expired. Reconnect Spotify and try again.',
            });
          }

          if (error.statusCode === 403) {
            try {
              const [currentUser, playlist] = await Promise.all([
                getSpotifyCurrentUser({
                  accessToken,
                }),
                getSpotifyPlaylistSummary({
                  accessToken,
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

            return reply.status(502).send({
              code: 'provider_forbidden',
              message:
                'Spotify denied this track add. Try a different track; if it still fails, reconnect Spotify and create a new event.',
            });
          }

          if (error.statusCode === 404) {
            return reply.status(502).send({
              code: 'provider_resource_not_found',
              message: 'Spotify playlist or track was not found. Create a new event and retry.',
            });
          }
        }

        const message = error instanceof Error ? error.message : 'Provider API error.';
        return reply.status(502).send({
          code: 'provider_add_track_failed',
          message,
        });
      }
    }

    const addedTrack = eventsStore.addTrackToEvent({
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
    const event = eventsStore.findEventById(eventId);
    if (!event || event.hostUserId !== userId) {
      return reply.status(404).send({
        code: 'event_not_found',
        message: 'Event not found.',
      });
    }

    return toEventResponse(event);
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
    const event = eventsStore.closeEvent({
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
