import {
  createSyncRequestSchema,
  createTransferRequestSchema,
  importSyncRequestSchema,
  importSyncResponseSchema,
  providerPlaylistListResponseSchema,
  type ProviderPlaylistItem,
  providerPlaylistTrackCountResponseSchema,
  providerPlaylistTracksResponseSchema,
  providerSchema,
  syncDetailResponseSchema,
  syncListResponseSchema,
  syncPublicResponseSchema,
  syncResponseSchema,
  transferBatchResponseSchema,
  updateSyncRequestSchema,
} from '@synqit/shared';
import { FastifyInstance } from 'fastify';

import { requireOwnedSync } from './guards';
import { importSyncForRecipient } from './import-engine';
import { syncsStore } from './store';
import { transfersStore, type TransferBatchRecord } from './transfer-store';
import { requireAuthenticatedUserId, resolveAuthenticatedUserId } from '../auth/guards';
import { withAppleMusicUserToken } from '../integrations/apple-client';
import { listAppleLibraryPlaylists, listApplePlaylistTracks } from '../integrations/apple-music';
import { mapProviderApiError } from '../integrations/provider-errors';
import { isSpotifyOauthLiveMode } from '../integrations/spotify';
import { withSpotifyAccessTokenRetry, IntegrationError } from '../integrations/spotify-client';
import { listSpotifyUserPlaylists } from '../integrations/spotify-playlists';
import { ProviderApiError, listSpotifyPlaylistTracks } from '../integrations/spotify-tracks';
import { integrationStore } from '../integrations/store';
import { enqueueTransferPlaylistJob } from '../jobs/transfers-queue';

const DEFAULT_SYNC_LINK_BASE_URL = 'http://127.0.0.1:5173';

const toTransferBatch = (batch: TransferBatchRecord) => ({
  id: batch.id,
  sourceProvider: batch.sourceProvider,
  destinationProvider: batch.destinationProvider,
  status: batch.status,
  createdAt: batch.createdAt.toISOString(),
  completedAt: batch.completedAt?.toISOString() ?? null,
  items: batch.items.map((item) => ({
    id: item.id,
    providerPlaylistId: item.providerPlaylistId,
    name: item.name,
    trackCount: item.trackCount,
    status: item.status,
    syncId: item.syncId,
    matchedCount: item.matchedCount,
    skippedCount: item.skippedCount,
    errorMessage: item.errorMessage,
    position: item.position,
  })),
});

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

const buildSyncMagicLinkUrl = (magicLinkToken: string): string => {
  const base = process.env.EVENT_LINK_BASE_URL ?? DEFAULT_SYNC_LINK_BASE_URL;
  return new URL(`/sync/${magicLinkToken}`, base).toString();
};

const resolveProviderPlaylistTrackCount = async (params: {
  userId: string;
  provider: 'spotify' | 'apple';
  providerPlaylistId: string;
}): Promise<number | null> => {
  if (params.provider === 'spotify') {
    if (!isSpotifyOauthLiveMode()) {
      const mockPlaylist = MOCK_PLAYLISTS.find(
        (playlist) => playlist.providerPlaylistId === params.providerPlaylistId,
      );
      return mockPlaylist?.trackCount ?? null;
    }

    const { result } = await withSpotifyAccessTokenRetry({
      userId: params.userId,
      run: async (accessToken) => {
        const tracks = await listSpotifyPlaylistTracks({
          accessToken,
          providerPlaylistId: params.providerPlaylistId,
        });
        return tracks.length;
      },
    });
    return result;
  }

  const result = await withAppleMusicUserToken({
    userId: params.userId,
    run: async (ctx) => {
      const tracks = await listApplePlaylistTracks({
        ...ctx,
        providerPlaylistId: params.providerPlaylistId,
      });
      return tracks.length;
    },
  });
  return result;
};

const toSyncItem = (sync: Awaited<ReturnType<typeof syncsStore.createSync>>) => ({
  ...sync,
  lastSyncedAt: sync.lastSyncedAt?.toISOString() ?? null,
  lastError: sync.lastError,
  magicLinkRevokedAt: sync.magicLinkRevokedAt?.toISOString() ?? null,
  createdAt: sync.createdAt.toISOString(),
  updatedAt: sync.updatedAt.toISOString(),
});

const toSyncResponse = (sync: Awaited<ReturnType<typeof syncsStore.createSync>>) =>
  syncResponseSchema.parse({
    sync: toSyncItem(sync),
    magicLinkUrl: buildSyncMagicLinkUrl(sync.magicLinkToken),
  });

// Decorate a provider's playlists with transfer history so the client can warn
// about (a) round-trips — the playlist was created by a prior Synqit transfer
// into this provider — and (b) re-transfers — this same source playlist was
// already transferred elsewhere before.
const annotatePlaylistOrigins = async (params: {
  userId: string;
  provider: 'spotify' | 'apple';
  playlists: ReadonlyArray<{
    providerPlaylistId: string;
    name: string;
    trackCount: number | null;
    coverImageUrl: string | null;
  }>;
}): Promise<ProviderPlaylistItem[]> => {
  const [origins, priorTransfers] = await Promise.all([
    syncsStore.findRecipientPlaylistOrigins({
      recipientUserId: params.userId,
      recipientProvider: params.provider,
    }),
    syncsStore.findSenderTransferredPlaylists({
      senderUserId: params.userId,
      provider: params.provider,
    }),
  ]);
  return params.playlists.map((playlist) => {
    const priorTransfer = priorTransfers.get(playlist.providerPlaylistId);
    return {
      ...playlist,
      origin: origins.get(playlist.providerPlaylistId) ?? null,
      priorTransfer: priorTransfer
        ? {
            destinationProviders: priorTransfer.destinationProviders,
            lastTransferredAt: priorTransfer.lastTransferredAt?.toISOString() ?? null,
          }
        : null,
    };
  });
};

export const registerSyncRoutes = async (app: FastifyInstance): Promise<void> => {
  // GET /syncs/provider-playlists?provider=spotify&limit=25&offset=0
  app.get('/syncs/provider-playlists', async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply);
    if (!userId) return;

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
        const playlists = await annotatePlaylistOrigins({
          userId,
          provider,
          playlists: MOCK_PLAYLISTS,
        });
        return reply.send(providerPlaylistListResponseSchema.parse({ playlists, hasMore: false }));
      }
      try {
        const { result } = await withSpotifyAccessTokenRetry({
          userId,
          run: (accessToken) => listSpotifyUserPlaylists({ accessToken, limit, offset }),
        });
        const playlists = await annotatePlaylistOrigins({
          userId,
          provider,
          playlists: result.playlists,
        });
        return reply.send(
          providerPlaylistListResponseSchema.parse({ playlists, hasMore: result.hasMore }),
        );
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
      const playlists = await annotatePlaylistOrigins({
        userId,
        provider,
        playlists: result.playlists,
      });
      return reply.send(
        providerPlaylistListResponseSchema.parse({ playlists, hasMore: result.hasMore }),
      );
    } catch (err) {
      if (err instanceof IntegrationError) {
        return reply.status(400).send({ code: err.code, message: err.message });
      }
      throw err;
    }
  });

  app.get('/syncs/provider-playlists/:providerPlaylistId/track-count', async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply);
    if (!userId) return;

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
      try {
        const trackCount = await resolveProviderPlaylistTrackCount({
          userId,
          provider,
          providerPlaylistId,
        });
        if (trackCount === null) {
          return reply.status(404).send({
            code: 'provider_resource_not_found',
            message: 'Spotify resource was not found.',
          });
        }
        return reply.send(providerPlaylistTrackCountResponseSchema.parse({ trackCount }));
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
      const trackCount = await resolveProviderPlaylistTrackCount({
        userId,
        provider,
        providerPlaylistId,
      });
      if (trackCount === null) {
        return reply.status(404).send({
          code: 'provider_resource_not_found',
          message: 'Apple Music resource was not found.',
        });
      }
      return reply.send(providerPlaylistTrackCountResponseSchema.parse({ trackCount }));
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

  app.get('/syncs/provider-playlists/:providerPlaylistId/tracks', async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply);
    if (!userId) return;

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

    try {
      if (provider === 'spotify') {
        if (!isSpotifyOauthLiveMode()) {
          return reply.send(providerPlaylistTracksResponseSchema.parse({ tracks: [] }));
        }

        const { result } = await withSpotifyAccessTokenRetry({
          userId,
          run: (accessToken) =>
            listSpotifyPlaylistTracks({
              accessToken,
              providerPlaylistId,
            }),
        });

        return reply.send(providerPlaylistTracksResponseSchema.parse({ tracks: result }));
      }

      const tracks = await withAppleMusicUserToken({
        userId,
        run: (ctx) =>
          listApplePlaylistTracks({
            ...ctx,
            providerPlaylistId,
          }),
      });

      return reply.send(providerPlaylistTracksResponseSchema.parse({ tracks }));
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
    const userId = await requireAuthenticatedUserId(request, reply);
    if (!userId) return;

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

    let trackCount = body.data.trackCount;
    if (trackCount === null) {
      try {
        trackCount = await resolveProviderPlaylistTrackCount({
          userId,
          provider: body.data.provider,
          providerPlaylistId: body.data.providerPlaylistId,
        });
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

    const sync = await syncsStore.createSync({
      senderUserId: userId,
      provider: body.data.provider,
      providerPlaylistId: body.data.providerPlaylistId,
      name: body.data.name,
      trackCount,
      syncMode: body.data.syncMode,
      kind: body.data.kind,
    });

    return reply.status(201).send(toSyncResponse(sync));
  });

  // GET /syncs
  app.get('/syncs', async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply);
    if (!userId) return;

    const [ownedSyncs, subscribedSyncs] = await Promise.all([
      syncsStore.listSyncsBySender(userId),
      syncsStore.listSyncsByRecipient(userId),
    ]);
    return reply.send(
      syncListResponseSchema.parse({
        ownedSyncs: ownedSyncs.map(toSyncItem),
        subscribedSyncs: subscribedSyncs.map(toSyncItem),
      }),
    );
  });

  // GET /syncs/:syncId (owner only)
  app.get('/syncs/:syncId', async (request, reply) => {
    const { syncId } = request.params as { syncId: string };
    const ownedSync = await requireOwnedSync({ request, reply, syncId });
    if (!ownedSync) return;
    const sync = ownedSync.sync;

    let tracks: Array<{
      providerTrackId: string;
      name: string;
      artist: string;
      album: string;
      durationMs: number;
      artworkUrl: string | null;
    }> = [];

    try {
      if (sync.provider === 'spotify') {
        if (isSpotifyOauthLiveMode()) {
          const { result } = await withSpotifyAccessTokenRetry({
            userId: sync.senderUserId,
            run: (accessToken) =>
              listSpotifyPlaylistTracks({
                accessToken,
                providerPlaylistId: sync.providerPlaylistId,
              }),
          });
          tracks = result;
        }
      } else {
        tracks = await withAppleMusicUserToken({
          userId: sync.senderUserId,
          run: (ctx) =>
            listApplePlaylistTracks({
              ...ctx,
              providerPlaylistId: sync.providerPlaylistId,
            }),
        });
      }
    } catch (err) {
      if (err instanceof ProviderApiError) {
        const mapped = mapProviderApiError(err);
        return reply.status(502).send({ code: 'provider_error', message: mapped.message });
      }
      if (err instanceof IntegrationError) {
        return reply.status(400).send({ code: err.code, message: err.message });
      }
      throw err;
    }

    if (tracks.length > 0) {
      await syncsStore.recordTrackActivity({
        syncId: sync.id,
        tracks,
        seenAt: new Date(),
        bootstrapSeenAt: sync.lastSyncedAt ?? sync.createdAt,
      });
    }

    const subscriberCounts = new Map<'spotify' | 'apple', number>([
      ['spotify', 0],
      ['apple', 0],
    ]);
    for (const importRecord of sync.imports) {
      subscriberCounts.set(
        importRecord.recipientProvider,
        (subscriberCounts.get(importRecord.recipientProvider) ?? 0) + 1,
      );
    }

    return reply.send(
      syncDetailResponseSchema.parse({
        sync: {
          ...toSyncItem(sync),
          subscriberCount: sync.imports.length,
          subscriberPlatformStats: [
            { provider: 'spotify', count: subscriberCounts.get('spotify') ?? 0 },
            { provider: 'apple', count: subscriberCounts.get('apple') ?? 0 },
          ],
          tracks,
        },
      }),
    );
  });

  // PATCH /syncs/:syncId (owner only)
  app.patch('/syncs/:syncId', async (request, reply) => {
    const { syncId } = request.params as { syncId: string };
    const ownedSync = await requireOwnedSync({ request, reply, syncId });
    if (!ownedSync) return;
    const body = updateSyncRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ code: 'invalid_request', message: body.error.message });
    }

    const sync = await syncsStore.updateOwnedSync({
      syncId,
      senderUserId: ownedSync.userId,
      syncMode: body.data.syncMode,
    });
    if (!sync) {
      return reply.status(404).send({ code: 'not_found', message: 'Sync not found.' });
    }

    return reply.send(toSyncResponse(sync));
  });

  app.post('/syncs/:syncId/magic-link/revoke', async (request, reply) => {
    const { syncId } = request.params as { syncId: string };
    const ownedSync = await requireOwnedSync({ request, reply, syncId });
    if (!ownedSync) return;
    const sync = await syncsStore.revokeMagicLink({
      syncId,
      senderUserId: ownedSync.userId,
    });
    if (!sync) {
      return reply.status(404).send({ code: 'not_found', message: 'Sync not found.' });
    }

    return reply.send(toSyncResponse(sync));
  });

  app.post('/syncs/:syncId/magic-link/regenerate', async (request, reply) => {
    const { syncId } = request.params as { syncId: string };
    const ownedSync = await requireOwnedSync({ request, reply, syncId });
    if (!ownedSync) return;
    const sync = await syncsStore.regenerateMagicLink({
      syncId,
      senderUserId: ownedSync.userId,
    });
    if (!sync) {
      return reply.status(404).send({ code: 'not_found', message: 'Sync not found.' });
    }

    return reply.send(toSyncResponse(sync));
  });

  // GET /syncs/link/:token  (public)
  app.get('/syncs/link/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const sync = await syncsStore.findSyncByMagicLinkToken(token);
    if (!sync)
      return reply.status(404).send({ code: 'not_found', message: 'Sync link not found.' });
    const currentUserId = await resolveAuthenticatedUserId(request);

    const subscriberCount = await syncsStore.countImports(sync.id);
    const existingImport = currentUserId
      ? await syncsStore.findImport({ syncId: sync.id, recipientUserId: currentUserId })
      : null;

    // Fetch source tracks to show on the public page
    let activityTracks: Array<{
      providerTrackId: string;
      name: string;
      artist: string;
      album: string;
      artworkUrl: string | null;
      durationMs: number;
    }> = [];
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
          activityTracks = result.map((t) => ({
            providerTrackId: t.providerTrackId,
            name: t.name,
            artist: t.artist,
            album: t.album ?? '',
            artworkUrl: t.artworkUrl ?? null,
            durationMs: t.durationMs,
          }));
        } else if (sync.provider === 'apple') {
          const rawTracks = await withAppleMusicUserToken({
            userId: sync.senderUserId,
            run: (ctx) =>
              listApplePlaylistTracks({ ...ctx, providerPlaylistId: sync.providerPlaylistId }),
          });
          activityTracks = rawTracks.map((t) => ({
            providerTrackId: t.providerTrackId,
            name: t.name,
            artist: t.artist,
            album: t.album ?? '',
            artworkUrl: t.artworkUrl ?? null,
            durationMs: t.durationMs,
          }));
        }
      } catch {
        // Non-fatal: page still renders without tracks
      }
    }

    if (activityTracks.length > 0) {
      await syncsStore.recordTrackActivity({
        syncId: sync.id,
        tracks: activityTracks,
        seenAt: new Date(),
        bootstrapSeenAt: sync.lastSyncedAt ?? sync.createdAt,
      });
    }

    return reply.send(
      syncPublicResponseSchema.parse({
        sync: {
          id: sync.id,
          provider: sync.provider,
          syncMode: sync.syncMode,
          name: sync.name,
          trackCount: sync.trackCount ?? activityTracks.length,
          isRevoked: sync.magicLinkRevokedAt !== null,
          isOwner: currentUserId === sync.senderUserId,
          isSubscribed: existingImport !== null,
          subscriberCount,
          tracks: activityTracks.map((track) => ({
            name: track.name,
            artist: track.artist,
            album: track.album,
            artworkUrl: track.artworkUrl,
          })),
        },
      }),
    );
  });

  // POST /syncs/link/:token/import  (auth required)
  app.post('/syncs/link/:token/import', async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply);
    if (!userId) return;

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

    try {
      const { matchedCount, skippedCount } = await importSyncForRecipient({
        sync,
        recipientUserId: userId,
        recipientProvider,
      });

      return reply.send(importSyncResponseSchema.parse({ ok: true, matchedCount, skippedCount }));
    } catch (err) {
      if (err instanceof ProviderApiError) {
        const mapped = mapProviderApiError(err);
        return reply.status(502).send({ code: 'provider_error', message: mapped.message });
      }
      throw err;
    }
  });

  // DELETE /syncs/link/:token/import  (auth required)
  // ---------------------------------------------------------------------
  // Transfers
  // ---------------------------------------------------------------------

  // POST /transfers  (auth required)
  // Queues a batch and returns immediately; the work runs on the transfers
  // queue so a large library does not have to finish inside one request.
  app.post('/transfers', async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply);
    if (!userId) return;

    const body = createTransferRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ code: 'invalid_request', message: body.error.message });
    }
    const { sourceProvider, destinationProvider, playlists } = body.data;

    for (const provider of [sourceProvider, destinationProvider]) {
      const integration = await integrationStore.findIntegration({ userId, provider });
      if (!integration) {
        return reply.status(400).send({
          code: 'provider_not_connected',
          message: 'Connect both streaming services first.',
        });
      }
    }

    const batch = await transfersStore.createBatch({
      userId,
      sourceProvider,
      destinationProvider,
      playlists,
    });

    try {
      for (const item of batch.items) {
        await enqueueTransferPlaylistJob({ batchId: batch.id, itemId: item.id });
      }
    } catch (err) {
      request.log.error({ err, batchId: batch.id }, 'failed to enqueue transfer jobs');
      return reply.status(503).send({
        code: 'queue_unavailable',
        message: 'Transfers are temporarily unavailable. Please try again shortly.',
      });
    }

    return reply
      .status(202)
      .send(transferBatchResponseSchema.parse({ batch: toTransferBatch(batch) }));
  });

  // GET /transfers/:batchId  (auth required) — polled for progress
  app.get('/transfers/:batchId', async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply);
    if (!userId) return;

    const { batchId } = request.params as { batchId: string };
    const batch = await transfersStore.findBatch({ batchId, userId });
    if (!batch) {
      return reply.status(404).send({ code: 'not_found', message: 'Transfer not found.' });
    }

    return reply.send(transferBatchResponseSchema.parse({ batch: toTransferBatch(batch) }));
  });

  app.delete('/syncs/link/:token/import', async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply);
    if (!userId) return;

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
