import type { Provider } from '@synqit/shared';

import { syncsStore, type SyncRecord } from './store';
import { buildTrackFingerprint } from './track-fingerprint';
import { withAppleMusicUserToken } from '../integrations/apple-client';
import {
  addAppleTracksToPlaylist,
  createAppleLibraryPlaylist,
  searchAppleCatalogTracks,
} from '../integrations/apple-music';
import { getProviderAdapter } from '../integrations/provider-registry';
import { mapWithConcurrency, withProviderRetry } from '../integrations/provider-throttle';
import { isSpotifyOauthLiveMode } from '../integrations/spotify';
import { withSpotifyAccessTokenRetry } from '../integrations/spotify-client';
import { createSpotifyPlaylist } from '../integrations/spotify-playlists';
import { addSpotifyTracksToPlaylist, searchSpotifyTracks } from '../integrations/spotify-tracks';
import { isTidalOauthLiveMode } from '../integrations/tidal';
import {
  addTidalTracksToPlaylist,
  createTidalPlaylist,
  searchTidalTracks,
} from '../integrations/tidal-api';
import { withTidalAccessTokenRetry } from '../integrations/tidal-client';
import { isYoutubeOauthLiveMode } from '../integrations/youtube';
import {
  addYoutubeTracksToPlaylist,
  createYoutubePlaylist,
  searchYoutubeTracks,
} from '../integrations/youtube-api';
import { withYoutubeAccessTokenRetry } from '../integrations/youtube-client';

// Providers rate-limit per app, not per playlist, so keep the search pool
// small enough that one big transfer does not starve everyone else.
const SEARCH_CONCURRENCY = 6;

type SourceTrack = {
  name: string;
  artist: string;
  providerTrackId: string;
  durationMs: number;
};

export type ImportSyncResult = {
  matchedCount: number;
  skippedCount: number;
  recipientProviderPlaylistId: string | null;
};

type MatchOutcome =
  | { status: 'matched'; recipientTrackId: string; sourceTrackFingerprint: string }
  | { status: 'skipped' };

const listSourceTracks = async (sync: SyncRecord): Promise<SourceTrack[]> => {
  const adapter = getProviderAdapter(sync.provider);
  if (!adapter.isLiveMode()) {
    return [];
  }
  return adapter.listPlaylistTracks({
    userId: sync.senderUserId,
    providerPlaylistId: sync.providerPlaylistId,
  });
};

export const importSyncForRecipient = async (params: {
  sync: SyncRecord;
  recipientUserId: string;
  recipientProvider: Provider;
  /** Overrides the created playlist's name. Defaults to `<sync name> (via Synqit)`. */
  playlistName?: string;
}): Promise<ImportSyncResult> => {
  const { sync, recipientUserId, recipientProvider } = params;

  const sourceTracks = await listSourceTracks(sync);

  if (sourceTracks.length > 0) {
    await syncsStore.recordTrackActivity({
      syncId: sync.id,
      tracks: sourceTracks,
      seenAt: new Date(),
      bootstrapSeenAt: sync.lastSyncedAt ?? sync.createdAt,
    });
  }

  // Resolve recipient credentials once for the whole run. Doing it per track
  // meant a database read and a token decrypt for every song in the playlist.
  const recipientCredentials =
    recipientProvider === 'youtube'
      ? ({
          provider: 'youtube',
          accessToken: isYoutubeOauthLiveMode()
            ? (
                await withYoutubeAccessTokenRetry({
                  userId: recipientUserId,
                  run: async (at) => at,
                })
              ).accessToken
            : null,
        } as const)
      : recipientProvider === 'tidal'
        ? ({
            provider: 'tidal',
            accessToken: isTidalOauthLiveMode()
              ? (
                  await withTidalAccessTokenRetry({
                    userId: recipientUserId,
                    run: async (at) => at,
                  })
                ).accessToken
              : null,
          } as const)
        : recipientProvider === 'spotify'
          ? ({
              provider: 'spotify',
              // Null outside live mode: the run still walks the tracks so the
              // same-provider shortcut below behaves as it always has.
              accessToken: isSpotifyOauthLiveMode()
                ? (
                    await withSpotifyAccessTokenRetry({
                      userId: recipientUserId,
                      run: async (at) => at,
                    })
                  ).accessToken
                : null,
            } as const)
          : ({
              provider: 'apple',
              tokens: await withAppleMusicUserToken({
                userId: recipientUserId,
                run: async (ctx) => ctx,
              }),
            } as const);

  const searchForMatch = async (track: SourceTrack): Promise<MatchOutcome> => {
    if (recipientProvider === sync.provider && track.providerTrackId) {
      return {
        status: 'matched',
        recipientTrackId: track.providerTrackId,
        sourceTrackFingerprint: buildTrackFingerprint(track),
      };
    }

    const query = `${track.name} ${track.artist}`;
    try {
      const results = await withProviderRetry(() => {
        if (recipientCredentials.provider === 'youtube') {
          return recipientCredentials.accessToken
            ? searchYoutubeTracks({
                accessToken: recipientCredentials.accessToken,
                query,
                limit: 1,
              })
            : Promise.resolve([]);
        }
        if (recipientCredentials.provider === 'tidal') {
          return recipientCredentials.accessToken
            ? searchTidalTracks({
                accessToken: recipientCredentials.accessToken,
                query,
                limit: 1,
              })
            : Promise.resolve([]);
        }
        if (recipientCredentials.provider === 'spotify') {
          return recipientCredentials.accessToken
            ? searchSpotifyTracks({
                accessToken: recipientCredentials.accessToken,
                query,
                limit: 1,
              })
            : Promise.resolve([]);
        }
        return searchAppleCatalogTracks({
          developerToken: recipientCredentials.tokens.developerToken,
          storefront: 'us',
          query,
          limit: 1,
        });
      });

      const first = results[0];
      if (first && first.name.toLowerCase().includes(track.name.toLowerCase())) {
        return {
          status: 'matched',
          recipientTrackId: first.providerTrackId,
          sourceTrackFingerprint: buildTrackFingerprint(track),
        };
      }
    } catch {
      // Fall through: an unresolvable search is a skipped track, not a failed
      // transfer. withProviderRetry has already absorbed rate limits.
    }

    return { status: 'skipped' };
  };

  // Searching stays one request per track (no provider offers a batch lookup),
  // but a small pool keeps a long playlist from running end to end.
  const matchOutcomes = await mapWithConcurrency(sourceTracks, SEARCH_CONCURRENCY, searchForMatch);

  // Resume: anything already recorded as synced on a previous attempt is left
  // alone so a retry tops the playlist up instead of duplicating it.
  const existingImport = await syncsStore.findImport({ syncId: sync.id, recipientUserId });
  const alreadySynced = new Set(existingImport?.syncedSourceTrackFingerprints ?? []);

  const matchedTracks = matchOutcomes.flatMap((outcome) =>
    outcome.status === 'matched' && !alreadySynced.has(outcome.sourceTrackFingerprint)
      ? [
          {
            recipientTrackId: outcome.recipientTrackId,
            sourceTrackFingerprint: outcome.sourceTrackFingerprint,
          },
        ]
      : [],
  );

  // Maps the batched add result back to source tracks. Two source tracks can
  // resolve to the same recipient id, so each id holds a queue of fingerprints
  // and every successful add consumes one.
  const pendingFingerprintsByTrackId = new Map<string, string[]>();
  for (const track of matchedTracks) {
    const pending = pendingFingerprintsByTrackId.get(track.recipientTrackId);
    if (pending) {
      pending.push(track.sourceTrackFingerprint);
    } else {
      pendingFingerprintsByTrackId.set(track.recipientTrackId, [track.sourceTrackFingerprint]);
    }
  }

  const syncedSourceTrackFingerprints = [...alreadySynced];
  const recordAdded = (addedTrackIds: readonly string[]): void => {
    for (const recipientTrackId of addedTrackIds) {
      const fingerprint = pendingFingerprintsByTrackId.get(recipientTrackId)?.shift();
      if (fingerprint) {
        syncedSourceTrackFingerprints.push(fingerprint);
      }
    }
  };

  const playlistName = params.playlistName ?? `${sync.name} (via Synqit)`;
  const providerTrackIds = matchedTracks.map((track) => track.recipientTrackId);
  let recipientProviderPlaylistId = existingImport?.recipientProviderPlaylistId ?? null;

  if (recipientCredentials.provider === 'youtube') {
    const { accessToken } = recipientCredentials;
    if (accessToken) {
      if (!recipientProviderPlaylistId) {
        const created = await createYoutubePlaylist({ accessToken, name: playlistName });
        recipientProviderPlaylistId = created.providerPlaylistId;
        await syncsStore.upsertImport({
          syncId: sync.id,
          recipientUserId,
          recipientProvider,
          recipientProviderPlaylistId,
          status: 'pending',
          matchedCount: existingImport?.matchedCount ?? 0,
          skippedCount: existingImport?.skippedCount ?? 0,
        });
      }

      // Inserts are one call each and stop at the first hard failure, which
      // for YouTube is usually the daily quota. Record every track as it lands
      // and checkpoint on failure, so the retry after the quota resets tops
      // the playlist up instead of starting over.
      try {
        await addYoutubeTracksToPlaylist({
          accessToken,
          providerPlaylistId: recipientProviderPlaylistId,
          providerTrackIds,
          onAdded: (providerTrackId) => recordAdded([providerTrackId]),
        });
      } catch (error) {
        await syncsStore.upsertImport({
          syncId: sync.id,
          recipientUserId,
          recipientProvider,
          recipientProviderPlaylistId,
          syncedSourceTrackFingerprints,
          syncedRecipientTrackFingerprints: syncedSourceTrackFingerprints,
          status: 'pending',
          matchedCount: syncedSourceTrackFingerprints.length,
          skippedCount: Math.max(0, sourceTracks.length - syncedSourceTrackFingerprints.length),
          lastError: error instanceof Error ? error.message : 'YouTube add failed.',
        });
        throw error;
      }
    }
  } else if (recipientCredentials.provider === 'tidal') {
    const { accessToken } = recipientCredentials;
    if (accessToken) {
      if (!recipientProviderPlaylistId) {
        const created = await createTidalPlaylist({ accessToken, name: playlistName });
        recipientProviderPlaylistId = created.providerPlaylistId;
        await syncsStore.upsertImport({
          syncId: sync.id,
          recipientUserId,
          recipientProvider,
          recipientProviderPlaylistId,
          status: 'pending',
          matchedCount: existingImport?.matchedCount ?? 0,
          skippedCount: existingImport?.skippedCount ?? 0,
        });
      }

      // TIDAL's add endpoint has no partial-success payload, so on success
      // every requested id counts as added.
      await addTidalTracksToPlaylist({
        accessToken,
        providerPlaylistId: recipientProviderPlaylistId,
        providerTrackIds,
      });
      recordAdded(providerTrackIds);
    }
  } else if (recipientCredentials.provider === 'spotify') {
    const { accessToken } = recipientCredentials;
    if (accessToken) {
      if (!recipientProviderPlaylistId) {
        const created = await createSpotifyPlaylist({
          accessToken,
          name: playlistName,
          description: '',
        });
        recipientProviderPlaylistId = created.providerPlaylistId;
        // Persist the id before adding tracks. A crash mid-add must not orphan
        // the playlist: the retry has to find and reuse it.
        await syncsStore.upsertImport({
          syncId: sync.id,
          recipientUserId,
          recipientProvider,
          recipientProviderPlaylistId,
          status: 'pending',
          matchedCount: existingImport?.matchedCount ?? 0,
          skippedCount: existingImport?.skippedCount ?? 0,
        });
      }

      const { addedTrackIds } = await addSpotifyTracksToPlaylist({
        accessToken,
        providerPlaylistId: recipientProviderPlaylistId,
        providerTrackIds,
      });
      recordAdded(addedTrackIds);
    }
  } else {
    const { tokens } = recipientCredentials;
    if (!recipientProviderPlaylistId) {
      const created = await createAppleLibraryPlaylist({
        ...tokens,
        name: playlistName,
        description: '',
      });
      recipientProviderPlaylistId = created.providerPlaylistId;
      await syncsStore.upsertImport({
        syncId: sync.id,
        recipientUserId,
        recipientProvider,
        recipientProviderPlaylistId,
        status: 'pending',
        matchedCount: existingImport?.matchedCount ?? 0,
        skippedCount: existingImport?.skippedCount ?? 0,
      });
    }

    const { addedTrackIds } = await addAppleTracksToPlaylist({
      ...tokens,
      providerPlaylistId: recipientProviderPlaylistId,
      providerTrackIds,
    });
    recordAdded(addedTrackIds);
  }

  const matchedCount = syncedSourceTrackFingerprints.length;
  const skippedCount = Math.max(0, sourceTracks.length - matchedCount);

  await syncsStore.upsertImport({
    syncId: sync.id,
    recipientUserId,
    recipientProvider,
    recipientProviderPlaylistId,
    syncedSourceTrackFingerprints,
    syncedRecipientTrackFingerprints: syncedSourceTrackFingerprints,
    status: 'completed',
    matchedCount,
    skippedCount,
    lastSyncedAt: new Date(),
    lastError: null,
  });

  return { matchedCount, skippedCount, recipientProviderPlaylistId };
};
