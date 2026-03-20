import { createHash } from 'node:crypto';

import { syncsStore, type SyncImportRecord, type SyncWithImportsRecord } from './store';
import { buildTrackFingerprint } from './track-fingerprint';
import { withAppleMusicUserToken } from '../integrations/apple-client';
import { getAppleUserStorefront } from '../integrations/apple-music';
import { listApplePlaylistTracks } from '../integrations/apple-music';
import { searchAppleCatalogTracks } from '../integrations/apple-music';
import { addAppleTrackToPlaylist } from '../integrations/apple-music';
import { createAppleLibraryPlaylist } from '../integrations/apple-music';
import { mapProviderApiError } from '../integrations/provider-errors';
import { isSpotifyOauthLiveMode } from '../integrations/spotify';
import { IntegrationError } from '../integrations/spotify-client';
import { withSpotifyAccessTokenRetry } from '../integrations/spotify-client';
import { createSpotifyPlaylist } from '../integrations/spotify-playlists';
import { ProviderApiError } from '../integrations/spotify-tracks';
import { addSpotifyTrackToPlaylist } from '../integrations/spotify-tracks';
import { listSpotifyPlaylistTracks } from '../integrations/spotify-tracks';
import { searchSpotifyTracks } from '../integrations/spotify-tracks';

type Logger = {
  info: (payload: unknown, message?: string) => void;
  error: (payload: unknown, message?: string) => void;
  warn?: (payload: unknown, message?: string) => void;
};

type SyncTrack = {
  providerTrackId: string;
  name: string;
  artist: string;
  album: string;
  durationMs: number;
};

const DEFAULT_AUTO_SYNC_INTERVAL_MS = 60_000;

const buildSourceFingerprint = (tracks: SyncTrack[]): string =>
  createHash('sha256')
    .update(tracks.map((track) => track.providerTrackId).join('\n'))
    .digest('hex');

const toErrorMessage = (error: unknown, provider?: 'spotify' | 'apple'): string => {
  if (error instanceof ProviderApiError) {
    if (provider && error.statusCode === 403) {
      const providerLabel = provider === 'spotify' ? 'Spotify' : 'Apple Music';
      return `Reconnect ${providerLabel}`;
    }

    return mapProviderApiError(error).message;
  }

  if (error instanceof IntegrationError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Automatic sync failed.';
};

const loadSourceTracks = async (sync: SyncWithImportsRecord): Promise<SyncTrack[]> => {
  if (sync.provider === 'spotify') {
    const { result } = await withSpotifyAccessTokenRetry({
      userId: sync.senderUserId,
      run: (accessToken) =>
        listSpotifyPlaylistTracks({
          accessToken,
          providerPlaylistId: sync.providerPlaylistId,
        }),
    });
    return result;
  }

  const tracks = await withAppleMusicUserToken({
    userId: sync.senderUserId,
    run: (ctx) =>
      listApplePlaylistTracks({
        ...ctx,
        providerPlaylistId: sync.providerPlaylistId,
      }),
  });

  return tracks;
};

const findSpotifyMatch = async (params: {
  userId: string;
  track: SyncTrack;
}): Promise<string | null> => {
  if (!isSpotifyOauthLiveMode()) {
    return null;
  }

  const sourceFingerprint = buildTrackFingerprint(params.track);
  const { result: accessToken } = await withSpotifyAccessTokenRetry({
    userId: params.userId,
    run: async (token) => token,
  });
  const results = await searchSpotifyTracks({
    accessToken,
    query: `${params.track.name} ${params.track.artist}`,
    limit: 5,
  });

  const exact = results.find((result) => buildTrackFingerprint(result) === sourceFingerprint);
  if (exact) {
    return exact.providerTrackId;
  }

  const fallback = results[0];
  return fallback?.providerTrackId ?? null;
};

const findAppleMatch = async (params: {
  userId: string;
  track: SyncTrack;
}): Promise<string | null> => {
  const sourceFingerprint = buildTrackFingerprint(params.track);

  return withAppleMusicUserToken({
    userId: params.userId,
    run: async (ctx) => {
      const storefront = await getAppleUserStorefront(ctx);
      const results = await searchAppleCatalogTracks({
        developerToken: ctx.developerToken,
        storefront,
        query: `${params.track.name} ${params.track.artist}`,
        limit: 5,
      });

      const exact = results.find((result) => buildTrackFingerprint(result) === sourceFingerprint);
      if (exact) {
        return exact.providerTrackId;
      }

      return results[0]?.providerTrackId ?? null;
    },
  });
};

const ensureRecipientPlaylist = async (params: {
  sync: SyncWithImportsRecord;
  importRecord: SyncImportRecord;
}): Promise<string | null> => {
  if (params.importRecord.recipientProviderPlaylistId) {
    return params.importRecord.recipientProviderPlaylistId;
  }

  const playlistName = `${params.sync.name} (via Synqit)`;

  if (params.importRecord.recipientProvider === 'spotify') {
    if (!isSpotifyOauthLiveMode()) {
      return null;
    }

    const { result: accessToken } = await withSpotifyAccessTokenRetry({
      userId: params.importRecord.recipientUserId,
      run: async (token) => token,
    });
    const created = await createSpotifyPlaylist({
      accessToken,
      name: playlistName,
      description: '',
    });
    return created.providerPlaylistId;
  }

  return withAppleMusicUserToken({
    userId: params.importRecord.recipientUserId,
    run: async (ctx) => {
      const created = await createAppleLibraryPlaylist({
        ...ctx,
        name: playlistName,
        description: '',
      });
      return created.providerPlaylistId;
    },
  });
};

const addTrackToRecipientPlaylist = async (params: {
  userId: string;
  provider: SyncImportRecord['recipientProvider'];
  recipientProviderPlaylistId: string;
  recipientTrackId: string;
}): Promise<void> => {
  if (params.provider === 'spotify') {
    const { result: accessToken } = await withSpotifyAccessTokenRetry({
      userId: params.userId,
      run: async (token) => token,
    });
    await addSpotifyTrackToPlaylist({
      accessToken,
      providerPlaylistId: params.recipientProviderPlaylistId,
      providerTrackId: params.recipientTrackId,
    });
    return;
  }

  await withAppleMusicUserToken({
    userId: params.userId,
    run: async (ctx) =>
      addAppleTrackToPlaylist({
        ...ctx,
        providerPlaylistId: params.recipientProviderPlaylistId,
        providerTrackId: params.recipientTrackId,
      }),
  });
};

const syncImport = async (params: {
  sync: SyncWithImportsRecord;
  importRecord: SyncImportRecord;
  sourceTracks: SyncTrack[];
}): Promise<{
  addedCount: number;
  recipientProviderPlaylistId: string | null;
  syncedSourceTrackFingerprints: string[];
}> => {
  const recipientProviderPlaylistId = await ensureRecipientPlaylist(params);
  if (!recipientProviderPlaylistId) {
    return {
      addedCount: 0,
      recipientProviderPlaylistId: null,
      syncedSourceTrackFingerprints: params.importRecord.syncedSourceTrackFingerprints,
    };
  }

  const syncedSourceTrackFingerprints = new Set(params.importRecord.syncedSourceTrackFingerprints);
  if (
    syncedSourceTrackFingerprints.size === 0 &&
    params.importRecord.lastSyncedAt &&
    params.importRecord.status === 'completed'
  ) {
    for (const sourceTrack of params.sourceTracks) {
      syncedSourceTrackFingerprints.add(buildTrackFingerprint(sourceTrack));
    }
  }

  let addedCount = 0;
  for (const sourceTrack of params.sourceTracks) {
    const trackFingerprint = buildTrackFingerprint(sourceTrack);
    if (syncedSourceTrackFingerprints.has(trackFingerprint)) {
      continue;
    }

    const matchedRecipientTrackId =
      params.importRecord.recipientProvider === 'spotify'
        ? await findSpotifyMatch({
            userId: params.importRecord.recipientUserId,
            track: sourceTrack,
          })
        : await findAppleMatch({
            userId: params.importRecord.recipientUserId,
            track: sourceTrack,
          });

    if (!matchedRecipientTrackId) {
      continue;
    }

    await addTrackToRecipientPlaylist({
      userId: params.importRecord.recipientUserId,
      provider: params.importRecord.recipientProvider,
      recipientProviderPlaylistId,
      recipientTrackId: matchedRecipientTrackId,
    });

    syncedSourceTrackFingerprints.add(trackFingerprint);
    addedCount += 1;
  }

  return {
    addedCount,
    recipientProviderPlaylistId,
    syncedSourceTrackFingerprints: Array.from(syncedSourceTrackFingerprints),
  };
};

export const runAutoSyncCycle = async (logger: Logger): Promise<void> => {
  const syncs = await syncsStore.listSyncsForAutoSync();

  for (const sync of syncs) {
    const polledAt = new Date();

    try {
      const sourceTracks = await loadSourceTracks(sync);
      const sourceFingerprint = buildSourceFingerprint(sourceTracks);
      const shouldRetryFailedImports = sync.imports.some((item) => item.lastError);

      await syncsStore.updateSyncAutoState({
        syncId: sync.id,
        trackCount: sourceTracks.length,
        lastPolledAt: polledAt,
      });

      if (sourceFingerprint === sync.lastSourceFingerprint && !shouldRetryFailedImports) {
        continue;
      }

      let syncLastError: string | null = null;
      for (const importRecord of sync.imports) {
        try {
          const result = await syncImport({
            sync,
            importRecord,
            sourceTracks,
          });

          await syncsStore.updateImportSyncState({
            syncId: sync.id,
            recipientUserId: importRecord.recipientUserId,
            recipientProviderPlaylistId: result.recipientProviderPlaylistId,
            syncedSourceTrackFingerprints: result.syncedSourceTrackFingerprints,
            status: 'completed',
            lastSyncedAt: polledAt,
            lastError: null,
          });
        } catch (error) {
          const message = toErrorMessage(error, importRecord.recipientProvider);
          syncLastError ??= message;
          await syncsStore.updateImportSyncState({
            syncId: sync.id,
            recipientUserId: importRecord.recipientUserId,
            status: 'failed',
            lastError: message,
          });
          logger.error(
            {
              err: error,
              syncId: sync.id,
              recipientUserId: importRecord.recipientUserId,
            },
            'automatic sync import failed',
          );
        }
      }

      await syncsStore.updateSyncAutoState({
        syncId: sync.id,
        trackCount: sourceTracks.length,
        lastSourceFingerprint: sourceFingerprint,
        lastPolledAt: polledAt,
        lastSyncedAt: syncLastError ? sync.lastSyncedAt : polledAt,
        lastError: syncLastError,
      });
    } catch (error) {
      const message = toErrorMessage(error, sync.provider);
      await syncsStore.updateSyncAutoState({
        syncId: sync.id,
        lastPolledAt: polledAt,
        lastError: message,
      });
      logger.error({ err: error, syncId: sync.id }, 'automatic sync failed');
    }
  }
};

export const startAutoSyncScheduler = (logger: Logger) => {
  if (process.env.AUTO_SYNC_ENABLED === 'false') {
    logger.info({ autoSyncEnabled: false }, 'automatic sync scheduler disabled');
    return () => undefined;
  }

  const intervalMs = Math.max(
    Number(process.env.SYNC_POLL_INTERVAL_MS ?? DEFAULT_AUTO_SYNC_INTERVAL_MS),
    10_000,
  );

  let isRunning = false;
  const tick = async () => {
    if (isRunning) {
      return;
    }

    isRunning = true;
    try {
      await runAutoSyncCycle(logger);
    } finally {
      isRunning = false;
    }
  };

  logger.info({ intervalMs }, 'automatic sync scheduler started');
  void tick();
  const intervalId = setInterval(() => {
    void tick();
  }, intervalMs);

  return () => {
    clearInterval(intervalId);
  };
};
