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

const diagnoseSpotifyRecipientPlaylistAccess = async (params: {
  userId: string;
  providerPlaylistId: string;
}) => {
  if (!isSpotifyOauthLiveMode()) {
    return null;
  }

  return withSpotifyAccessTokenRetry({
    userId: params.userId,
    run: async (accessToken) => {
      const currentUserResponse = await fetch('https://api.spotify.com/v1/me', {
        method: 'GET',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });
      const currentUserPayload = (await currentUserResponse.json().catch(() => ({}))) as unknown;

      const playlistResponse = await fetch(
        `https://api.spotify.com/v1/playlists/${encodeURIComponent(params.providerPlaylistId)}`,
        {
          method: 'GET',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
      );
      const playlistPayload = (await playlistResponse.json().catch(() => ({}))) as unknown;

      const playlistInfo =
        playlistPayload &&
        typeof playlistPayload === 'object' &&
        'owner' in playlistPayload &&
        playlistPayload.owner &&
        typeof playlistPayload.owner === 'object'
          ? {
              ownerId:
                'id' in playlistPayload.owner && typeof playlistPayload.owner.id === 'string'
                  ? playlistPayload.owner.id
                  : null,
              collaborative:
                'collaborative' in playlistPayload &&
                typeof playlistPayload.collaborative === 'boolean'
                  ? playlistPayload.collaborative
                  : null,
              public:
                'public' in playlistPayload &&
                (typeof playlistPayload.public === 'boolean' || playlistPayload.public === null)
                  ? playlistPayload.public
                  : null,
              name:
                'name' in playlistPayload && typeof playlistPayload.name === 'string'
                  ? playlistPayload.name
                  : null,
            }
          : null;

      return {
        currentUserStatus: currentUserResponse.status,
        currentUserId:
          currentUserPayload &&
          typeof currentUserPayload === 'object' &&
          'id' in currentUserPayload &&
          typeof currentUserPayload.id === 'string'
            ? currentUserPayload.id
            : null,
        playlistStatus: playlistResponse.status,
        playlistInfo,
        playlistPayload,
      };
    },
  });
};

const loadSourceTracks = async (sync: SyncWithImportsRecord): Promise<SyncTrack[]> => {
  return loadPlaylistTracks({
    provider: sync.provider,
    userId: sync.senderUserId,
    providerPlaylistId: sync.providerPlaylistId,
  });
};

const loadPlaylistTracks = async (params: {
  provider: 'spotify' | 'apple';
  userId: string;
  providerPlaylistId: string;
}): Promise<SyncTrack[]> => {
  if (params.provider === 'spotify') {
    const { result } = await withSpotifyAccessTokenRetry({
      userId: params.userId,
      run: (accessToken) =>
        listSpotifyPlaylistTracks({
          accessToken,
          providerPlaylistId: params.providerPlaylistId,
        }),
    });
    return result;
  }

  const tracks = await withAppleMusicUserToken({
    userId: params.userId,
    run: (ctx) =>
      listApplePlaylistTracks({
        ...ctx,
        providerPlaylistId: params.providerPlaylistId,
      }),
  });

  return tracks;
};

const loadImportTracks = async (importRecord: SyncImportRecord): Promise<SyncTrack[]> => {
  if (!importRecord.recipientProviderPlaylistId) {
    return [];
  }

  return loadPlaylistTracks({
    provider: importRecord.recipientProvider,
    userId: importRecord.recipientUserId,
    providerPlaylistId: importRecord.recipientProviderPlaylistId,
  });
};

const findProviderMatch = async (params: {
  provider: 'spotify' | 'apple';
  userId: string;
  track: SyncTrack;
}): Promise<string | null> => {
  return params.provider === 'spotify'
    ? findSpotifyMatch({ userId: params.userId, track: params.track })
    : findAppleMatch({ userId: params.userId, track: params.track });
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

const syncSourceToImport = async (params: {
  sync: SyncWithImportsRecord;
  importRecord: SyncImportRecord;
  sourceTracks: SyncTrack[];
}): Promise<{
  addedCount: number;
  recipientProviderPlaylistId: string | null;
  syncedSourceTrackFingerprints: string[];
  syncedRecipientTrackFingerprints: string[];
}> => {
  const recipientProviderPlaylistId = await ensureRecipientPlaylist(params);
  if (!recipientProviderPlaylistId) {
    return {
      addedCount: 0,
      recipientProviderPlaylistId: null,
      syncedSourceTrackFingerprints: params.importRecord.syncedSourceTrackFingerprints,
      syncedRecipientTrackFingerprints: params.importRecord.syncedRecipientTrackFingerprints,
    };
  }

  const syncedSourceTrackFingerprints = new Set(params.importRecord.syncedSourceTrackFingerprints);
  const syncedRecipientTrackFingerprints = new Set(
    params.importRecord.syncedRecipientTrackFingerprints,
  );
  const recipientTracks = await loadImportTracks({
    ...params.importRecord,
    recipientProviderPlaylistId,
  });
  const recipientProviderTrackIds = new Set(
    recipientTracks.map((track) => track.providerTrackId).filter(Boolean),
  );
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

    if (recipientProviderTrackIds.has(matchedRecipientTrackId)) {
      syncedSourceTrackFingerprints.add(trackFingerprint);
      syncedRecipientTrackFingerprints.add(trackFingerprint);
      continue;
    }

    await addTrackToRecipientPlaylist({
      userId: params.importRecord.recipientUserId,
      provider: params.importRecord.recipientProvider,
      recipientProviderPlaylistId,
      recipientTrackId: matchedRecipientTrackId,
    });

    recipientProviderTrackIds.add(matchedRecipientTrackId);
    syncedSourceTrackFingerprints.add(trackFingerprint);
    syncedRecipientTrackFingerprints.add(trackFingerprint);
    addedCount += 1;
  }

  return {
    addedCount,
    recipientProviderPlaylistId,
    syncedSourceTrackFingerprints: Array.from(syncedSourceTrackFingerprints),
    syncedRecipientTrackFingerprints: Array.from(syncedRecipientTrackFingerprints),
  };
};

const syncImportBackToSource = async (params: {
  sync: SyncWithImportsRecord;
  importRecord: SyncImportRecord;
  syncedSourceTrackFingerprints: string[];
  syncedRecipientTrackFingerprints: string[];
}): Promise<{
  addedCount: number;
  syncedSourceTrackFingerprints: string[];
  syncedRecipientTrackFingerprints: string[];
}> => {
  if (
    params.sync.syncMode !== 'bidirectional' ||
    !params.importRecord.recipientProviderPlaylistId
  ) {
    return {
      addedCount: 0,
      syncedSourceTrackFingerprints: params.syncedSourceTrackFingerprints,
      syncedRecipientTrackFingerprints: params.syncedRecipientTrackFingerprints,
    };
  }

  const recipientTracks = await loadImportTracks(params.importRecord);
  const syncedSourceTrackFingerprints = new Set(params.syncedSourceTrackFingerprints);
  const syncedRecipientTrackFingerprints = new Set(params.syncedRecipientTrackFingerprints);

  // Backfill a baseline for imports created before the recipient-side ledger existed.
  if (
    syncedRecipientTrackFingerprints.size === 0 &&
    params.importRecord.lastSyncedAt &&
    params.importRecord.status === 'completed'
  ) {
    for (const recipientTrack of recipientTracks) {
      syncedRecipientTrackFingerprints.add(buildTrackFingerprint(recipientTrack));
    }
  }

  let addedCount = 0;
  for (const recipientTrack of recipientTracks) {
    const trackFingerprint = buildTrackFingerprint(recipientTrack);
    if (syncedRecipientTrackFingerprints.has(trackFingerprint)) {
      continue;
    }

    const matchedSourceTrackId = await findProviderMatch({
      provider: params.sync.provider,
      userId: params.sync.senderUserId,
      track: recipientTrack,
    });

    if (!matchedSourceTrackId) {
      continue;
    }

    await addTrackToRecipientPlaylist({
      userId: params.sync.senderUserId,
      provider: params.sync.provider,
      recipientProviderPlaylistId: params.sync.providerPlaylistId,
      recipientTrackId: matchedSourceTrackId,
    });

    syncedRecipientTrackFingerprints.add(trackFingerprint);
    syncedSourceTrackFingerprints.add(trackFingerprint);
    addedCount += 1;
  }

  return {
    addedCount,
    syncedSourceTrackFingerprints: Array.from(syncedSourceTrackFingerprints),
    syncedRecipientTrackFingerprints: Array.from(syncedRecipientTrackFingerprints),
  };
};

export const runAutoSyncCycle = async (logger: Logger): Promise<void> => {
  const syncs = await syncsStore.listSyncsForAutoSync();
  logger.info({ syncCount: syncs.length }, '[poll] automatic sync tick');

  for (const sync of syncs) {
    const polledAt = new Date();

    try {
      const sourceTracks = await loadSourceTracks(sync);
      const sourceFingerprint = buildSourceFingerprint(sourceTracks);
      const shouldRetryFailedImports = sync.imports.some((item) => item.lastError);
      const shouldProcessImports =
        sync.syncMode === 'bidirectional' ||
        sourceFingerprint !== sync.lastSourceFingerprint ||
        shouldRetryFailedImports;

      await syncsStore.updateSyncAutoState({
        syncId: sync.id,
        trackCount: sourceTracks.length,
        lastPolledAt: polledAt,
      });

      logger.info(
        {
          syncId: sync.id,
          syncMode: sync.syncMode,
          importCount: sync.imports.length,
          sourceTrackCount: sourceTracks.length,
          sourceChanged: sourceFingerprint !== sync.lastSourceFingerprint,
          shouldRetryFailedImports,
          shouldProcessImports,
        },
        '[poll] automatic sync polled',
      );

      if (!shouldProcessImports) {
        logger.info({ syncId: sync.id }, '[poll] automatic sync skipped');
        continue;
      }

      let syncLastError: string | null = null;
      for (const importRecord of sync.imports) {
        try {
          const forwardResult = await syncSourceToImport({
            sync,
            importRecord,
            sourceTracks,
          });
          const reverseResult = await syncImportBackToSource({
            sync,
            importRecord,
            syncedSourceTrackFingerprints: forwardResult.syncedSourceTrackFingerprints,
            syncedRecipientTrackFingerprints: forwardResult.syncedRecipientTrackFingerprints,
          });

          logger.info(
            {
              syncId: sync.id,
              recipientUserId: importRecord.recipientUserId,
              recipientProvider: importRecord.recipientProvider,
              sourceToRecipientAddedCount: forwardResult.addedCount,
              recipientToSourceAddedCount: reverseResult.addedCount,
            },
            '[poll] automatic sync import completed',
          );

          await syncsStore.updateImportSyncState({
            syncId: sync.id,
            recipientUserId: importRecord.recipientUserId,
            recipientProviderPlaylistId: forwardResult.recipientProviderPlaylistId,
            syncedSourceTrackFingerprints: reverseResult.syncedSourceTrackFingerprints,
            syncedRecipientTrackFingerprints: reverseResult.syncedRecipientTrackFingerprints,
            status: 'completed',
            lastSyncedAt: polledAt,
            lastError: null,
          });
        } catch (error) {
          if (
            importRecord.recipientProvider === 'spotify' &&
            importRecord.recipientProviderPlaylistId &&
            error instanceof ProviderApiError &&
            error.statusCode === 403
          ) {
            try {
              const diagnostics = await diagnoseSpotifyRecipientPlaylistAccess({
                userId: importRecord.recipientUserId,
                providerPlaylistId: importRecord.recipientProviderPlaylistId,
              });
              const payload = {
                syncId: sync.id,
                recipientUserId: importRecord.recipientUserId,
                recipientProviderPlaylistId: importRecord.recipientProviderPlaylistId,
                diagnostics,
              };
              if (logger.warn) {
                logger.warn(payload, 'spotify recipient playlist access diagnostics');
              } else {
                logger.error(payload, 'spotify recipient playlist access diagnostics');
              }
            } catch (diagnosticError) {
              const payload = {
                syncId: sync.id,
                recipientUserId: importRecord.recipientUserId,
                recipientProviderPlaylistId: importRecord.recipientProviderPlaylistId,
                err: diagnosticError,
              };
              if (logger.warn) {
                logger.warn(payload, 'spotify recipient playlist diagnostics failed');
              } else {
                logger.error(payload, 'spotify recipient playlist diagnostics failed');
              }
            }
          }

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

  logger.info({ syncCount: syncs.length }, '[poll] automatic sync tick complete');
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
