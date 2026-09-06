import { createHash } from 'node:crypto';

import { syncsStore, type SyncImportRecord, type SyncWithImportsRecord } from './store';
import { buildTrackFingerprint } from './track-fingerprint';
import { withAppleMusicUserToken } from '../integrations/apple-client';
import { getAppleUserStorefront } from '../integrations/apple-music';
import { listApplePlaylistTracks } from '../integrations/apple-music';
import { searchAppleCatalogTracks } from '../integrations/apple-music';
import { findAppleCatalogSongByIsrc } from '../integrations/apple-music';
import { addAppleTrackToPlaylist } from '../integrations/apple-music';
import { createAppleLibraryPlaylist } from '../integrations/apple-music';
import { mapProviderApiError } from '../integrations/provider-errors';
import { isSpotifyOauthLiveMode } from '../integrations/spotify';
import { IntegrationError } from '../integrations/spotify-client';
import { withSpotifyAccessTokenRetry } from '../integrations/spotify-client';
import { createSpotifyPlaylist } from '../integrations/spotify-playlists';
import { getSpotifyPlaylistSummary } from '../integrations/spotify-playlists';
import { ProviderApiError } from '../integrations/spotify-tracks';
import { addSpotifyTrackToPlaylist } from '../integrations/spotify-tracks';
import { listSpotifyPlaylistTracks } from '../integrations/spotify-tracks';
import { searchSpotifyTracks } from '../integrations/spotify-tracks';

type Logger = {
  info: (payload: unknown, message?: string) => void;
  error: (payload: unknown, message?: string) => void;
  warn?: (payload: unknown, message?: string) => void;
};

export type SyncTrack = {
  providerTrackId: string;
  name: string;
  artist: string;
  album: string;
  durationMs: number;
  /** ISRC when the source exposes it; enables exact cross-provider matching. */
  isrc?: string | null;
};

const DEFAULT_AUTO_SYNC_INTERVAL_MS = 60_000;
const DEFAULT_MAX_AUTO_SYNC_INTERVAL_MS = 15 * 60_000;
const DEFAULT_APPLE_MAX_AUTO_SYNC_INTERVAL_MS = 30 * 60_000;
const DEFAULT_APPLE_BACKOFF_MULTIPLIER = 3;

const buildSourceFingerprint = (tracks: SyncTrack[]): string =>
  createHash('sha256')
    .update(tracks.map((track) => track.providerTrackId).join('\n'))
    .digest('hex');

const mergeTracksByFingerprint = (tracks: SyncTrack[], additions: SyncTrack[]): SyncTrack[] => {
  const merged = [...tracks];
  const fingerprints = new Set(tracks.map((track) => buildTrackFingerprint(track)));

  for (const track of additions) {
    const fingerprint = buildTrackFingerprint(track);
    if (fingerprints.has(fingerprint)) {
      continue;
    }

    fingerprints.add(fingerprint);
    merged.push(track);
  }

  return merged;
};

const hasAppleInSync = (sync: SyncWithImportsRecord): boolean =>
  sync.provider === 'apple' ||
  (sync.syncMode === 'bidirectional' &&
    sync.imports.some((item) => item.recipientProvider === 'apple'));

const computeNextPollPlan = (params: {
  sync: SyncWithImportsRecord;
  hadChange: boolean;
  hadError: boolean;
  now: Date;
}) => {
  const baseIntervalMs = Math.max(
    Number(process.env.SYNC_POLL_INTERVAL_MS ?? DEFAULT_AUTO_SYNC_INTERVAL_MS),
    10_000,
  );
  const hasApple = hasAppleInSync(params.sync);
  const maxIntervalMs = Math.max(
    Number(
      hasApple
        ? (process.env.APPLE_SYNC_MAX_POLL_INTERVAL_MS ?? DEFAULT_APPLE_MAX_AUTO_SYNC_INTERVAL_MS)
        : (process.env.MAX_SYNC_POLL_INTERVAL_MS ?? DEFAULT_MAX_AUTO_SYNC_INTERVAL_MS),
    ),
    baseIntervalMs,
  );

  if (params.hadChange || params.hadError) {
    return {
      nextPollAt: new Date(params.now.getTime() + baseIntervalMs),
      unchangedPollStreak: 0,
      intervalMs: baseIntervalMs,
    };
  }

  const nextStreak = params.sync.unchangedPollStreak + 1;
  const multiplier = hasApple ? DEFAULT_APPLE_BACKOFF_MULTIPLIER : 2;
  const intervalMs = Math.min(baseIntervalMs * multiplier ** nextStreak, maxIntervalMs);

  return {
    nextPollAt: new Date(params.now.getTime() + intervalMs),
    unchangedPollStreak: nextStreak,
    intervalMs,
  };
};

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

  const { result } = await withSpotifyAccessTokenRetry({
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

  return result;
};

const loadSpotifyPlaylistSnapshot = async (params: {
  userId: string;
  providerPlaylistId: string;
}): Promise<string> => {
  const { result } = await withSpotifyAccessTokenRetry({
    userId: params.userId,
    run: (accessToken) =>
      getSpotifyPlaylistSummary({
        accessToken,
        providerPlaylistId: params.providerPlaylistId,
      }),
  });

  return result.snapshotId;
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

export const findProviderMatch = async (params: {
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

  // Exact match by ISRC when the source provides one (Deezer, Spotify, Apple).
  if (params.track.isrc) {
    const byIsrc = await searchSpotifyTracks({
      accessToken,
      query: `isrc:${params.track.isrc}`,
      limit: 1,
    });
    if (byIsrc[0]) {
      return byIsrc[0].providerTrackId;
    }
  }

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

      if (params.track.isrc) {
        const byIsrc = await findAppleCatalogSongByIsrc({
          developerToken: ctx.developerToken,
          storefront,
          isrc: params.track.isrc,
        });
        if (byIsrc) {
          return byIsrc.providerTrackId;
        }
      }

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

/** Creates an empty playlist in the user's library; null when Spotify is not in live mode. */
export const createRecipientPlaylist = async (params: {
  userId: string;
  provider: 'spotify' | 'apple';
  name: string;
}): Promise<string | null> => {
  if (params.provider === 'spotify') {
    if (!isSpotifyOauthLiveMode()) {
      return null;
    }

    const { result: accessToken } = await withSpotifyAccessTokenRetry({
      userId: params.userId,
      run: async (token) => token,
    });
    const created = await createSpotifyPlaylist({
      accessToken,
      name: params.name,
      description: '',
    });
    return created.providerPlaylistId;
  }

  return withAppleMusicUserToken({
    userId: params.userId,
    run: async (ctx) => {
      const created = await createAppleLibraryPlaylist({
        ...ctx,
        name: params.name,
        description: '',
      });
      return created.providerPlaylistId;
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

  return createRecipientPlaylist({
    userId: params.importRecord.recipientUserId,
    provider: params.importRecord.recipientProvider,
    name: `${params.sync.name} (via Synqit)`,
  });
};

export const addTrackToRecipientPlaylist = async (params: {
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
      params.importRecord.recipientProvider === params.sync.provider
        ? sourceTrack.providerTrackId
        : params.importRecord.recipientProvider === 'spotify'
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
  sourceTracks: SyncTrack[];
  recipientTracks?: SyncTrack[];
}): Promise<{
  addedCount: number;
  addedSourceTracks: SyncTrack[];
  syncedSourceTrackFingerprints: string[];
  syncedRecipientTrackFingerprints: string[];
}> => {
  if (
    params.sync.syncMode !== 'bidirectional' ||
    !params.importRecord.recipientProviderPlaylistId
  ) {
    return {
      addedCount: 0,
      addedSourceTracks: [],
      syncedSourceTrackFingerprints: params.syncedSourceTrackFingerprints,
      syncedRecipientTrackFingerprints: params.syncedRecipientTrackFingerprints,
    };
  }

  const recipientTracks = params.recipientTracks ?? (await loadImportTracks(params.importRecord));
  const syncedSourceTrackFingerprints = new Set(params.syncedSourceTrackFingerprints);
  const syncedRecipientTrackFingerprints = new Set(params.syncedRecipientTrackFingerprints);
  const sourceTrackFingerprints = new Set(
    params.sourceTracks.map((track) => buildTrackFingerprint(track)),
  );

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
  const addedSourceTracks: SyncTrack[] = [];
  for (const recipientTrack of recipientTracks) {
    const trackFingerprint = buildTrackFingerprint(recipientTrack);
    if (syncedRecipientTrackFingerprints.has(trackFingerprint)) {
      continue;
    }

    if (sourceTrackFingerprints.has(trackFingerprint)) {
      syncedRecipientTrackFingerprints.add(trackFingerprint);
      syncedSourceTrackFingerprints.add(trackFingerprint);
      continue;
    }

    const matchedSourceTrackId =
      params.importRecord.recipientProvider === params.sync.provider
        ? recipientTrack.providerTrackId
        : await findProviderMatch({
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
    sourceTrackFingerprints.add(trackFingerprint);
    addedSourceTracks.push({
      ...recipientTrack,
      providerTrackId: matchedSourceTrackId,
    });
    addedCount += 1;
  }

  return {
    addedCount,
    addedSourceTracks,
    syncedSourceTrackFingerprints: Array.from(syncedSourceTrackFingerprints),
    syncedRecipientTrackFingerprints: Array.from(syncedRecipientTrackFingerprints),
  };
};

export const runAutoSyncCycle = async (logger: Logger): Promise<void> => {
  const syncs = await syncsStore.listSyncsForAutoSync();
  logger.info({ syncCount: syncs.length }, '[api][poll] automatic sync tick');

  for (const sync of syncs) {
    const polledAt = new Date();

    try {
      const shouldRetryFailedImports = sync.imports.some((item) => item.lastError);
      let sourceTracks: SyncTrack[] = [];
      let sourceFingerprint = sync.lastSourceFingerprint;
      let sourceChanged = true;
      let sourceTrackCount = sync.trackCount;
      let sourceSnapshotId = sync.lastSourceSnapshotId;

      if (sync.provider === 'spotify' && isSpotifyOauthLiveMode()) {
        sourceSnapshotId = await loadSpotifyPlaylistSnapshot({
          userId: sync.senderUserId,
          providerPlaylistId: sync.providerPlaylistId,
        });
        sourceChanged = sourceSnapshotId !== sync.lastSourceSnapshotId;

        if (sourceChanged || shouldRetryFailedImports) {
          sourceTracks = await loadSourceTracks(sync);
          sourceFingerprint = buildSourceFingerprint(sourceTracks);
          sourceTrackCount = sourceTracks.length;
        }
      } else {
        sourceTracks = await loadSourceTracks(sync);
        sourceFingerprint = buildSourceFingerprint(sourceTracks);
        sourceSnapshotId = sourceFingerprint;
        sourceTrackCount = sourceTracks.length;
        sourceChanged = sourceSnapshotId !== sync.lastSourceSnapshotId;
      }

      const shouldProcessImports =
        sync.syncMode === 'bidirectional' || sourceChanged || shouldRetryFailedImports;

      type PreparedImportState = {
        importRecord: SyncImportRecord;
        shouldRetryImport: boolean;
        recipientChanged: boolean;
        recipientSnapshotId: string | null;
        preloadedRecipientTracks?: SyncTrack[];
      };

      const importStates: PreparedImportState[] = [];
      let detectedChange = sourceChanged;

      for (const importRecord of sync.imports) {
        const shouldRetryImport = Boolean(importRecord.lastError);
        let recipientChanged = sync.syncMode === 'bidirectional';
        let recipientSnapshotId = importRecord.lastRecipientSnapshotId;
        let preloadedRecipientTracks: SyncTrack[] | undefined;

        if (sync.syncMode === 'bidirectional' && importRecord.recipientProviderPlaylistId) {
          if (importRecord.recipientProvider === 'spotify' && isSpotifyOauthLiveMode()) {
            recipientSnapshotId = await loadSpotifyPlaylistSnapshot({
              userId: importRecord.recipientUserId,
              providerPlaylistId: importRecord.recipientProviderPlaylistId,
            });
            recipientChanged = recipientSnapshotId !== importRecord.lastRecipientSnapshotId;
          } else {
            preloadedRecipientTracks = await loadImportTracks(importRecord);
            recipientSnapshotId = buildSourceFingerprint(preloadedRecipientTracks);
            recipientChanged = recipientSnapshotId !== importRecord.lastRecipientSnapshotId;
          }
        }

        detectedChange ||= recipientChanged;
        importStates.push({
          importRecord,
          shouldRetryImport,
          recipientChanged,
          recipientSnapshotId,
          preloadedRecipientTracks,
        });
      }

      if (
        sync.syncMode === 'bidirectional' &&
        sourceTracks.length === 0 &&
        importStates.some((state) => state.recipientChanged || state.shouldRetryImport)
      ) {
        sourceTracks = await loadSourceTracks(sync);
        sourceFingerprint = buildSourceFingerprint(sourceTracks);
        sourceTrackCount = sourceTracks.length;
      }

      await syncsStore.updateSyncAutoState({
        syncId: sync.id,
        trackCount: sourceTrackCount,
        lastSourceSnapshotId: sourceSnapshotId,
        lastSourceFingerprint: sourceFingerprint,
        lastPolledAt: polledAt,
      });

      logger.info(
        {
          syncId: sync.id,
          syncMode: sync.syncMode,
          importCount: sync.imports.length,
          sourceTrackCount,
          sourceChanged,
          shouldRetryFailedImports,
          shouldProcessImports,
        },
        '[api][poll] automatic sync polled',
      );

      if (sourceTracks.length > 0) {
        await syncsStore.recordTrackActivity({
          syncId: sync.id,
          tracks: sourceTracks,
          seenAt: polledAt,
          bootstrapSeenAt: sync.lastSyncedAt ?? sync.createdAt,
        });
      }

      if (!shouldProcessImports) {
        logger.info({ syncId: sync.id }, '[api][poll] automatic sync skipped');
        continue;
      }

      let syncLastError: string | null = null;
      let effectiveSourceChanged = sourceChanged;
      const preparedResults = new Map<
        string,
        {
          recipientProviderPlaylistId: string | null;
          syncedSourceTrackFingerprints: string[];
          syncedRecipientTrackFingerprints: string[];
          reverseAddedCount: number;
          recipientSnapshotId: string | null;
          shouldRetryImport: boolean;
        }
      >();

      for (const state of importStates) {
        try {
          if (!sourceChanged && !state.recipientChanged && !state.shouldRetryImport) {
            logger.info(
              {
                syncId: sync.id,
                recipientUserId: state.importRecord.recipientUserId,
                recipientProvider: state.importRecord.recipientProvider,
                recipientChanged: state.recipientChanged,
                sourceChanged,
              },
              '[api][poll] automatic sync import skipped',
            );
            await syncsStore.updateImportSyncState({
              syncId: sync.id,
              recipientUserId: state.importRecord.recipientUserId,
              lastRecipientSnapshotId: state.recipientSnapshotId,
              status: 'completed',
              lastError: null,
            });
            continue;
          }

          let reverseResult = {
            addedCount: 0,
            addedSourceTracks: [] as SyncTrack[],
            syncedSourceTrackFingerprints: state.importRecord.syncedSourceTrackFingerprints,
            syncedRecipientTrackFingerprints: state.importRecord.syncedRecipientTrackFingerprints,
          };

          if (
            sync.syncMode === 'bidirectional' &&
            (state.recipientChanged || state.shouldRetryImport)
          ) {
            reverseResult = await syncImportBackToSource({
              sync,
              importRecord: state.importRecord,
              syncedSourceTrackFingerprints: state.importRecord.syncedSourceTrackFingerprints,
              syncedRecipientTrackFingerprints: state.importRecord.syncedRecipientTrackFingerprints,
              sourceTracks,
              recipientTracks: state.preloadedRecipientTracks,
            });
          }

          if (reverseResult.addedSourceTracks.length > 0) {
            effectiveSourceChanged = true;
            detectedChange = true;
            sourceTracks = mergeTracksByFingerprint(sourceTracks, reverseResult.addedSourceTracks);
            sourceFingerprint = buildSourceFingerprint(sourceTracks);
            sourceTrackCount = sourceTracks.length;
          }

          preparedResults.set(state.importRecord.id, {
            recipientProviderPlaylistId: state.importRecord.recipientProviderPlaylistId,
            syncedSourceTrackFingerprints: reverseResult.syncedSourceTrackFingerprints,
            syncedRecipientTrackFingerprints: reverseResult.syncedRecipientTrackFingerprints,
            reverseAddedCount: reverseResult.addedCount,
            recipientSnapshotId: state.recipientSnapshotId,
            shouldRetryImport: state.shouldRetryImport,
          });
        } catch (error) {
          if (
            state.importRecord.recipientProvider === 'spotify' &&
            state.importRecord.recipientProviderPlaylistId &&
            error instanceof ProviderApiError &&
            error.statusCode === 403
          ) {
            try {
              const diagnostics = await diagnoseSpotifyRecipientPlaylistAccess({
                userId: state.importRecord.recipientUserId,
                providerPlaylistId: state.importRecord.recipientProviderPlaylistId,
              });
              const payload = {
                syncId: sync.id,
                recipientUserId: state.importRecord.recipientUserId,
                recipientProviderPlaylistId: state.importRecord.recipientProviderPlaylistId,
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
                recipientUserId: state.importRecord.recipientUserId,
                recipientProviderPlaylistId: state.importRecord.recipientProviderPlaylistId,
                err: diagnosticError,
              };
              if (logger.warn) {
                logger.warn(payload, 'spotify recipient playlist diagnostics failed');
              } else {
                logger.error(payload, 'spotify recipient playlist diagnostics failed');
              }
            }
          }

          const message = toErrorMessage(error, state.importRecord.recipientProvider);
          syncLastError ??= message;
          await syncsStore.updateImportSyncState({
            syncId: sync.id,
            recipientUserId: state.importRecord.recipientUserId,
            status: 'failed',
            lastError: message,
          });
          logger.error(
            {
              err: error,
              syncId: sync.id,
              recipientUserId: state.importRecord.recipientUserId,
            },
            'automatic sync import failed',
          );
        }
      }

      for (const state of importStates) {
        const prepared = preparedResults.get(state.importRecord.id);
        if (!prepared) {
          continue;
        }

        try {
          let forwardResult = {
            addedCount: 0,
            recipientProviderPlaylistId: prepared.recipientProviderPlaylistId,
            syncedSourceTrackFingerprints: prepared.syncedSourceTrackFingerprints,
            syncedRecipientTrackFingerprints: prepared.syncedRecipientTrackFingerprints,
          };

          if (effectiveSourceChanged || prepared.shouldRetryImport) {
            forwardResult = await syncSourceToImport({
              sync,
              importRecord: {
                ...state.importRecord,
                recipientProviderPlaylistId: prepared.recipientProviderPlaylistId,
                syncedSourceTrackFingerprints: prepared.syncedSourceTrackFingerprints,
                syncedRecipientTrackFingerprints: prepared.syncedRecipientTrackFingerprints,
              },
              sourceTracks,
            });
          }

          logger.info(
            {
              syncId: sync.id,
              recipientUserId: state.importRecord.recipientUserId,
              recipientProvider: state.importRecord.recipientProvider,
              sourceToRecipientAddedCount: forwardResult.addedCount,
              recipientToSourceAddedCount: prepared.reverseAddedCount,
            },
            '[api][poll] automatic sync import completed',
          );

          await syncsStore.updateImportSyncState({
            syncId: sync.id,
            recipientUserId: state.importRecord.recipientUserId,
            recipientProviderPlaylistId: forwardResult.recipientProviderPlaylistId,
            lastRecipientSnapshotId: prepared.recipientSnapshotId,
            syncedSourceTrackFingerprints: forwardResult.syncedSourceTrackFingerprints,
            syncedRecipientTrackFingerprints: forwardResult.syncedRecipientTrackFingerprints,
            status: 'completed',
            lastSyncedAt: polledAt,
            lastError: null,
          });
        } catch (error) {
          const message = toErrorMessage(error, state.importRecord.recipientProvider);
          syncLastError ??= message;
          await syncsStore.updateImportSyncState({
            syncId: sync.id,
            recipientUserId: state.importRecord.recipientUserId,
            status: 'failed',
            lastError: message,
          });
          logger.error(
            {
              err: error,
              syncId: sync.id,
              recipientUserId: state.importRecord.recipientUserId,
            },
            'automatic sync import failed',
          );
        }
      }

      const pollPlan = computeNextPollPlan({
        sync,
        hadChange: detectedChange,
        hadError: Boolean(syncLastError),
        now: polledAt,
      });

      if (sourceTracks.length > 0) {
        await syncsStore.recordTrackActivity({
          syncId: sync.id,
          tracks: sourceTracks,
          seenAt: polledAt,
          bootstrapSeenAt: sync.lastSyncedAt ?? sync.createdAt,
        });
      }

      await syncsStore.updateSyncAutoState({
        syncId: sync.id,
        trackCount: sourceTrackCount,
        nextPollAt: pollPlan.nextPollAt,
        unchangedPollStreak: pollPlan.unchangedPollStreak,
        lastSourceSnapshotId: sourceSnapshotId,
        lastSourceFingerprint: sourceFingerprint,
        lastPolledAt: polledAt,
        lastSyncedAt: syncLastError ? sync.lastSyncedAt : polledAt,
        lastError: syncLastError,
      });

      logger.info(
        {
          syncId: sync.id,
          hadChange: detectedChange,
          hadError: Boolean(syncLastError),
          unchangedPollStreak: pollPlan.unchangedPollStreak,
          nextPollAt: pollPlan.nextPollAt.toISOString(),
          nextPollInMs: pollPlan.intervalMs,
        },
        '[api][poll] automatic sync scheduled',
      );
    } catch (error) {
      const message = toErrorMessage(error, sync.provider);
      const pollPlan = computeNextPollPlan({
        sync,
        hadChange: false,
        hadError: true,
        now: polledAt,
      });
      await syncsStore.updateSyncAutoState({
        syncId: sync.id,
        nextPollAt: pollPlan.nextPollAt,
        unchangedPollStreak: pollPlan.unchangedPollStreak,
        lastPolledAt: polledAt,
        lastError: message,
      });
      logger.error({ err: error, syncId: sync.id }, 'automatic sync failed');
    }
  }

  logger.info({ syncCount: syncs.length }, '[api][poll] automatic sync tick complete');
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
