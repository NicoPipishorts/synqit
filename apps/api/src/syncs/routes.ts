import {
  createSyncRequestSchema,
  importSyncRequestSchema,
  importSyncResponseSchema,
  providerPlaylistListResponseSchema,
  providerPlaylistTrackCountResponseSchema,
  providerSchema,
  syncListResponseSchema,
  syncPublicResponseSchema,
  syncResponseSchema,
} from '@synqit/shared';
import { FastifyInstance, FastifyRequest } from 'fastify';

import { syncsStore } from './store';
import { authStore } from '../auth/store';
import { withAppleMusicUserToken } from '../integrations/apple-client';
import {
  listAppleLibraryPlaylists,
  listApplePlaylistTracks,
  searchAppleCatalogTracks,
  createAppleLibraryPlaylist,
  addAppleTrackToPlaylist,
  getAppleUserStorefront,
} from '../integrations/apple-music';
import { mapProviderApiError } from '../integrations/provider-errors';
import { isSpotifyOauthLiveMode } from '../integrations/spotify';
import { withSpotifyAccessTokenRetry, IntegrationError } from '../integrations/spotify-client';
import { listSpotifyUserPlaylists, createSpotifyPlaylist } from '../integrations/spotify-playlists';
import {
  ProviderApiError,
  listSpotifyPlaylistTracks,
  searchSpotifyTracks,
  addSpotifyTrackToPlaylist,
} from '../integrations/spotify-tracks';
import { integrationStore } from '../integrations/store';

const DEFAULT_SYNC_LINK_BASE_URL = 'http://127.0.0.1:5173';

const MOCK_PLAYLISTS = [
  {
    providerPlaylistId: 'mock-playlist-1',
    name: 'Summer Vibes',
    trackCount: 24,
    coverImageUrl: null,
  },
  {
    providerPlaylistId: 'mock-playlist-2',
    name: 'Late Night Drive',
    trackCount: 18,
    coverImageUrl: null,
  },
  {
    providerPlaylistId: 'mock-playlist-3',
    name: 'Focus Mode',
    trackCount: 32,
    coverImageUrl: null,
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
  if (!userId) return null;

  const user = await authStore.findUserById(userId);
  if (!user || user.isBlocked) return null;

  return userId;
};

const buildSyncMagicLinkUrl = (magicLinkToken: string): string => {
  const base = process.env.EVENT_LINK_BASE_URL ?? DEFAULT_SYNC_LINK_BASE_URL;
  return new URL(`/sync/${magicLinkToken}`, base).toString();
};

const toSyncResponse = (sync: Awaited<ReturnType<typeof syncsStore.createSync>>) =>
  syncResponseSchema.parse({
    sync: {
      ...sync,
      magicLinkRevokedAt: sync.magicLinkRevokedAt?.toISOString() ?? null,
      createdAt: sync.createdAt.toISOString(),
      updatedAt: sync.updatedAt.toISOString(),
    },
    magicLinkUrl: buildSyncMagicLinkUrl(sync.magicLinkToken),
  });

export const registerSyncRoutes = async (app: FastifyInstance): Promise<void> => {
  // GET /syncs/provider-playlists?provider=spotify&limit=25&offset=0
  app.get('/syncs/provider-playlists', async (request, reply) => {
    const userId = await verifyAndGetUserId(request);
    if (!userId)
      return reply.status(401).send({ code: 'unauthorized', message: 'Authentication required.' });

    const query = request.query as Record<string, string>;
    const providerResult = providerSchema.safeParse(query.provider);
    if (!providerResult.success) {
      return reply.status(400).send({ code: 'invalid_provider', message: 'Invalid provider.' });
    }
    const provider = providerResult.data;
    const limit = Math.min(Number(query.limit ?? 25), 50);
    const offset = Number(query.offset ?? 0);

    if (provider === 'spotify') {
      if (!isSpotifyOauthLiveMode()) {
        return reply.send(
          providerPlaylistListResponseSchema.parse({ playlists: MOCK_PLAYLISTS, hasMore: false }),
        );
      }
      try {
        const { result } = await withSpotifyAccessTokenRetry({
          userId,
          run: (accessToken) => listSpotifyUserPlaylists({ accessToken, limit, offset }),
        });
        return reply.send(providerPlaylistListResponseSchema.parse(result));
      } catch (err) {
        if (err instanceof IntegrationError) {
          return reply.status(400).send({ code: err.code, message: err.message });
        }
        throw err;
      }
    }

    // Apple
    try {
      const result = await withAppleMusicUserToken({
        userId,
        run: (ctx) => listAppleLibraryPlaylists({ ...ctx, limit, offset }),
      });
      return reply.send(providerPlaylistListResponseSchema.parse(result));
    } catch (err) {
      if (err instanceof IntegrationError) {
        return reply.status(400).send({ code: err.code, message: err.message });
      }
      throw err;
    }
  });

  app.get('/syncs/provider-playlists/:providerPlaylistId/track-count', async (request, reply) => {
    const userId = await verifyAndGetUserId(request);
    if (!userId) {
      return reply.status(401).send({ code: 'unauthorized', message: 'Authentication required.' });
    }

    const providerPlaylistId =
      (request.params as { providerPlaylistId?: string }).providerPlaylistId ?? '';
    if (!providerPlaylistId) {
      return reply.status(400).send({
        code: 'validation_error',
        message: 'Provider playlist id is required.',
      });
    }

    const query = request.query as Record<string, string>;
    const providerResult = providerSchema.safeParse(query.provider);
    if (!providerResult.success) {
      return reply.status(400).send({ code: 'invalid_provider', message: 'Invalid provider.' });
    }

    const provider = providerResult.data;

    if (provider === 'spotify') {
      if (!isSpotifyOauthLiveMode()) {
        const mockPlaylist = MOCK_PLAYLISTS.find(
          (playlist) => playlist.providerPlaylistId === providerPlaylistId,
        );
        if (!mockPlaylist) {
          return reply.status(404).send({
            code: 'provider_resource_not_found',
            message: 'Spotify resource was not found.',
          });
        }

        return reply.send(
          providerPlaylistTrackCountResponseSchema.parse({
            trackCount: mockPlaylist.trackCount,
          }),
        );
      }

      try {
        const { result } = await withSpotifyAccessTokenRetry({
          userId,
          run: async (accessToken) => {
            const tracks = await listSpotifyPlaylistTracks({
              accessToken,
              providerPlaylistId,
            });
            return providerPlaylistTrackCountResponseSchema.parse({
              trackCount: tracks.length,
            });
          },
        });
        return reply.send(result);
      } catch (err) {
        if (err instanceof IntegrationError) {
          return reply.status(400).send({ code: err.code, message: err.message });
        }
        if (err instanceof ProviderApiError) {
          const mapped = mapProviderApiError(err);
          return reply.status(err.statusCode).send(mapped);
        }
        throw err;
      }
    }

    try {
      const result = await withAppleMusicUserToken({
        userId,
        run: async (ctx) => {
          const tracks = await listApplePlaylistTracks({
            ...ctx,
            providerPlaylistId,
          });
          return providerPlaylistTrackCountResponseSchema.parse({
            trackCount: tracks.length,
          });
        },
      });
      return reply.send(result);
    } catch (err) {
      if (err instanceof IntegrationError) {
        return reply.status(400).send({ code: err.code, message: err.message });
      }
      if (err instanceof ProviderApiError) {
        const mapped = mapProviderApiError(err);
        return reply.status(err.statusCode).send(mapped);
      }
      throw err;
    }
  });

  // POST /syncs
  app.post('/syncs', async (request, reply) => {
    const userId = await verifyAndGetUserId(request);
    if (!userId)
      return reply.status(401).send({ code: 'unauthorized', message: 'Authentication required.' });

    const body = createSyncRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ code: 'invalid_request', message: body.error.message });
    }

    const integration = await integrationStore.findIntegration({
      userId,
      provider: body.data.provider,
    });
    if (!integration) {
      return reply
        .status(400)
        .send({ code: 'provider_not_connected', message: 'Provider not connected.' });
    }

    const sync = await syncsStore.createSync({
      senderUserId: userId,
      provider: body.data.provider,
      providerPlaylistId: body.data.providerPlaylistId,
      name: body.data.name,
      trackCount: body.data.trackCount,
    });

    return reply.status(201).send(toSyncResponse(sync));
  });

  // GET /syncs
  app.get('/syncs', async (request, reply) => {
    const userId = await verifyAndGetUserId(request);
    if (!userId)
      return reply.status(401).send({ code: 'unauthorized', message: 'Authentication required.' });

    const syncs = await syncsStore.listSyncsBySender(userId);
    return reply.send(
      syncListResponseSchema.parse({
        syncs: syncs.map((s) => ({
          ...s,
          magicLinkRevokedAt: s.magicLinkRevokedAt?.toISOString() ?? null,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
        })),
      }),
    );
  });

  // GET /syncs/link/:token  (public)
  app.get('/syncs/link/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const sync = await syncsStore.findSyncByMagicLinkToken(token);
    if (!sync)
      return reply.status(404).send({ code: 'not_found', message: 'Sync link not found.' });
    const currentUserId = await verifyAndGetUserId(request);

    const subscriberCount = await syncsStore.countImports(sync.id);
    const existingImport = currentUserId
      ? await syncsStore.findImport({ syncId: sync.id, recipientUserId: currentUserId })
      : null;

    // Fetch source tracks to show on the public page
    let tracks: Array<{ name: string; artist: string; album: string; artworkUrl: string | null }> =
      [];
    if (!sync.magicLinkRevokedAt) {
      try {
        if (sync.provider === 'spotify' && isSpotifyOauthLiveMode()) {
          const { result } = await withSpotifyAccessTokenRetry({
            userId: sync.senderUserId,
            run: (accessToken) =>
              listSpotifyPlaylistTracks({
                accessToken,
                providerPlaylistId: sync.providerPlaylistId,
              }),
          });
          tracks = result.map((t) => ({
            name: t.name,
            artist: t.artist,
            album: t.album ?? '',
            artworkUrl: t.artworkUrl ?? null,
          }));
        } else if (sync.provider === 'apple') {
          const rawTracks = await withAppleMusicUserToken({
            userId: sync.senderUserId,
            run: (ctx) =>
              listApplePlaylistTracks({ ...ctx, providerPlaylistId: sync.providerPlaylistId }),
          });
          tracks = rawTracks.map((t) => ({
            name: t.name,
            artist: t.artist,
            album: t.album ?? '',
            artworkUrl: t.artworkUrl ?? null,
          }));
        }
      } catch {
        // Non-fatal: page still renders without tracks
      }
    }

    return reply.send(
      syncPublicResponseSchema.parse({
        sync: {
          id: sync.id,
          provider: sync.provider,
          name: sync.name,
          trackCount: sync.trackCount ?? tracks.length,
          isRevoked: sync.magicLinkRevokedAt !== null,
          isOwner: currentUserId === sync.senderUserId,
          isSubscribed: existingImport !== null,
          subscriberCount,
          tracks,
        },
      }),
    );
  });

  // POST /syncs/link/:token/import  (auth required)
  app.post('/syncs/link/:token/import', async (request, reply) => {
    const userId = await verifyAndGetUserId(request);
    if (!userId)
      return reply.status(401).send({ code: 'unauthorized', message: 'Authentication required.' });

    const { token } = request.params as { token: string };
    const sync = await syncsStore.findSyncByMagicLinkToken(token);
    if (!sync)
      return reply.status(404).send({ code: 'not_found', message: 'Sync link not found.' });
    if (sync.magicLinkRevokedAt)
      return reply
        .status(410)
        .send({ code: 'sync_revoked', message: 'This sync link has been revoked.' });

    const body = importSyncRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ code: 'invalid_request', message: body.error.message });
    }
    const recipientProvider = body.data.recipientProvider;

    const recipientIntegration = await integrationStore.findIntegration({
      userId,
      provider: recipientProvider,
    });
    if (!recipientIntegration) {
      return reply
        .status(400)
        .send({ code: 'provider_not_connected', message: 'Connect your streaming service first.' });
    }

    // -----------------------------------------------------------------------
    // 1. Fetch source tracks from sender's provider
    // -----------------------------------------------------------------------
    let sourceTracks: Array<{ name: string; artist: string; providerTrackId: string }> = [];

    if (sync.provider === 'spotify') {
      if (isSpotifyOauthLiveMode()) {
        try {
          const { result } = await withSpotifyAccessTokenRetry({
            userId: sync.senderUserId,
            run: (accessToken) =>
              listSpotifyPlaylistTracks({
                accessToken,
                providerPlaylistId: sync.providerPlaylistId,
              }),
          });
          sourceTracks = result;
        } catch (err) {
          if (err instanceof ProviderApiError) {
            const mapped = mapProviderApiError(err);
            return reply.status(502).send({ code: 'provider_error', message: mapped.message });
          }
          throw err;
        }
      }
    } else {
      try {
        const tracks = await withAppleMusicUserToken({
          userId: sync.senderUserId,
          run: (ctx) =>
            listApplePlaylistTracks({ ...ctx, providerPlaylistId: sync.providerPlaylistId }),
        });
        sourceTracks = tracks;
      } catch (err) {
        if (err instanceof ProviderApiError) {
          const mapped = mapProviderApiError(err);
          return reply.status(502).send({ code: 'provider_error', message: mapped.message });
        }
        throw err;
      }
    }

    // -----------------------------------------------------------------------
    // 2. Match tracks in recipient's provider and collect matched IDs
    // -----------------------------------------------------------------------
    const matchedTrackIds: string[] = [];
    const skippedTracks: string[] = [];

    for (const track of sourceTracks) {
      const query = `${track.name} ${track.artist}`;
      try {
        if (recipientProvider === 'spotify') {
          if (isSpotifyOauthLiveMode()) {
            const { result: spotifyAccessToken } = await withSpotifyAccessTokenRetry({
              userId,
              run: async (at) => at,
            });
            const results = await searchSpotifyTracks({
              accessToken: spotifyAccessToken,
              query,
              limit: 1,
            });
            const first = results[0];
            if (first && first.name.toLowerCase().includes(track.name.toLowerCase())) {
              matchedTrackIds.push(first.providerTrackId);
            } else {
              skippedTracks.push(track.providerTrackId);
            }
          }
        } else {
          await withAppleMusicUserToken({
            userId,
            run: async ({ developerToken }) => {
              const results = await searchAppleCatalogTracks({
                developerToken,
                storefront: 'us',
                query,
                limit: 1,
              });
              const first = results[0];
              if (first && first.name.toLowerCase().includes(track.name.toLowerCase())) {
                matchedTrackIds.push(first.providerTrackId);
              } else {
                skippedTracks.push(track.providerTrackId);
              }
            },
          });
        }
      } catch {
        skippedTracks.push(track.providerTrackId);
      }
    }

    // -----------------------------------------------------------------------
    // 3. Create playlist in recipient's provider and add matched tracks
    // -----------------------------------------------------------------------
    const playlistName = `${sync.name} (via Synqit)`;

    if (matchedTrackIds.length > 0) {
      if (recipientProvider === 'spotify') {
        if (isSpotifyOauthLiveMode()) {
          try {
            const { result: accessToken } = await withSpotifyAccessTokenRetry({
              userId,
              run: async (at) => at,
            });
            const created = await createSpotifyPlaylist({
              accessToken,
              name: playlistName,
              description: '',
            });
            for (const trackId of matchedTrackIds) {
              await addSpotifyTrackToPlaylist({
                accessToken,
                providerPlaylistId: created.providerPlaylistId,
                providerTrackId: trackId,
              }).catch(() => null);
            }
          } catch (err) {
            if (err instanceof ProviderApiError) {
              const mapped = mapProviderApiError(err);
              return reply.status(502).send({ code: 'provider_error', message: mapped.message });
            }
            throw err;
          }
        }
      } else {
        try {
          await withAppleMusicUserToken({
            userId,
            run: async (ctx) => {
              const storefront = await getAppleUserStorefront(ctx);
              const created = await createAppleLibraryPlaylist({
                ...ctx,
                name: playlistName,
                description: '',
              });
              for (const trackId of matchedTrackIds) {
                // Resolve catalog ID via search first
                const results = await searchAppleCatalogTracks({
                  developerToken: ctx.developerToken,
                  storefront,
                  query: trackId,
                  limit: 1,
                }).catch(() => []);
                const catalogId = results[0]?.providerTrackId ?? trackId;
                await addAppleTrackToPlaylist({
                  ...ctx,
                  providerPlaylistId: created.providerPlaylistId,
                  providerTrackId: catalogId,
                }).catch(() => null);
              }
            },
          });
        } catch (err) {
          if (err instanceof ProviderApiError) {
            const mapped = mapProviderApiError(err);
            return reply.status(502).send({ code: 'provider_error', message: mapped.message });
          }
          throw err;
        }
      }
    }

    const matchedCount = matchedTrackIds.length;
    await syncsStore.upsertImport({
      syncId: sync.id,
      recipientUserId: userId,
      recipientProvider,
      status: 'completed',
      matchedCount,
      skippedCount: Math.max(0, sourceTracks.length - matchedCount),
    });

    return reply.send(
      importSyncResponseSchema.parse({
        ok: true,
        matchedCount,
        skippedCount: Math.max(0, sourceTracks.length - matchedCount),
      }),
    );
  });

  // DELETE /syncs/link/:token/import  (auth required)
  app.delete('/syncs/link/:token/import', async (request, reply) => {
    const userId = await verifyAndGetUserId(request);
    if (!userId) {
      return reply.status(401).send({ code: 'unauthorized', message: 'Authentication required.' });
    }

    const { token } = request.params as { token: string };
    const sync = await syncsStore.findSyncByMagicLinkToken(token);
    if (!sync) {
      return reply.status(404).send({ code: 'not_found', message: 'Sync link not found.' });
    }

    const deleted = await syncsStore.deleteImport({
      syncId: sync.id,
      recipientUserId: userId,
    });

    if (!deleted) {
      return reply
        .status(404)
        .send({ code: 'not_found', message: 'You are not subscribed to this playlist.' });
    }

    return reply.send({ ok: true });
  });
};
