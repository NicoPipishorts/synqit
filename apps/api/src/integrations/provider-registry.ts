import type { Provider, ProviderPlaylistItem } from '@synqit/shared';

import { getAppleStorefront, isAppleLiveMode } from './apple';
import { withAppleMusicUserToken } from './apple-client';
import {
  addAppleTrackToPlaylist,
  addAppleTracksToPlaylist,
  createAppleLibraryPlaylist,
  findAppleCatalogSongByIsrc,
  getAppleLibraryPlaylist,
  getAppleUserStorefront,
  listAppleLibraryPlaylists,
  listApplePlaylistTracks,
  removeAppleTrackFromPlaylist,
  searchAppleCatalogTracks,
} from './apple-music';
import { isSpotifyOauthLiveMode } from './spotify';
import { withSpotifyAccessTokenRetry } from './spotify-client';
import { createSpotifyPlaylist, listSpotifyUserPlaylists } from './spotify-playlists';
import {
  addSpotifyTrackToPlaylist,
  addSpotifyTracksToPlaylist,
  listSpotifyPlaylistTracks,
  removeSpotifyTrackFromPlaylist,
  searchSpotifyTracks,
} from './spotify-tracks';
import { isTidalOauthLiveMode } from './tidal';
import {
  addTidalTracksToPlaylist,
  createTidalPlaylist,
  findTidalTrackByIsrc,
  getTidalCurrentUserId,
  listTidalPlaylistTracks,
  listTidalUserPlaylists,
  removeTidalTrackFromPlaylist,
  searchTidalTracks,
} from './tidal-api';
import { withTidalAccessTokenRetry } from './tidal-client';
import { isYoutubeOauthLiveMode } from './youtube';
import {
  addYoutubeTrackToPlaylist,
  addYoutubeTracksToPlaylist,
  createYoutubePlaylist,
  listYoutubePlaylistTracks,
  listYoutubeUserPlaylists,
  removeYoutubeTrackFromPlaylist,
  searchYoutubeTracks,
} from './youtube-api';
import { withYoutubeAccessTokenRetry } from './youtube-client';

/**
 * One shape for every music service the app writes to.
 *
 * Before this existed, each new provider meant an `if (provider === 'spotify')`
 * in nine files. Callers now ask the registry for an adapter and the provider
 * list is a compile-time exhaustive record, so adding a service is additive.
 *
 * Each adapter takes a `userId` and resolves its own credentials, because the
 * services authenticate differently: Spotify and YouTube refresh an OAuth
 * token, Apple pairs a developer token with a music-user token, TIDAL uses PKCE.
 */

export type ProviderTrack = {
  providerTrackId: string;
  name: string;
  artist: string;
  album: string;
  durationMs: number;
  artworkUrl: string | null;
  previewUrl: string | null;
  /** Recording id, when the service exposes one. Enables exact matching. */
  isrc?: string | null;
};

export type ProviderPlaylistPage = {
  playlists: ProviderPlaylistItem[];
  hasMore: boolean;
};

export type ProviderAdapter = {
  id: Provider;
  /** Human name for UI and error copy. */
  label: string;
  /** False when the service's credentials are unset, so callers can degrade. */
  isLiveMode: () => boolean;
  listUserPlaylists: (params: {
    userId: string;
    limit: number;
    offset: number;
  }) => Promise<ProviderPlaylistPage>;
  listPlaylistTracks: (params: {
    userId: string;
    providerPlaylistId: string;
  }) => Promise<ProviderTrack[]>;
  createPlaylist: (params: {
    userId: string;
    name: string;
    description?: string;
  }) => Promise<string>;
  /**
   * Bulk add for transfers and sync: tolerant by design, a track the service
   * refuses is dropped and the rest still land.
   */
  addTracks: (params: {
    userId: string;
    providerPlaylistId: string;
    providerTrackIds: readonly string[];
  }) => Promise<void>;
  /**
   * Single add for a guest at an event: strict, so the refusal reaches the
   * guest and a vanished playlist closes the event instead of hiding.
   */
  addTrack: (params: {
    userId: string;
    providerPlaylistId: string;
    providerTrackId: string;
  }) => Promise<void>;
  removeTrack: (params: {
    userId: string;
    providerPlaylistId: string;
    providerTrackId: string;
  }) => Promise<void>;
  searchTracks: (params: {
    userId: string;
    query: string;
    limit?: number;
    /** Paging for guest search; ignored by services whose search does not page. */
    offset?: number;
  }) => Promise<ProviderTrack[]>;
  /** Exact lookup; null when the service cannot do it or has no match. */
  findTrackByIsrc: (params: { userId: string; isrc: string }) => Promise<ProviderTrack | null>;
  /**
   * Current name and description as the service shows them, for services where
   * the host may rename the playlist in the service's own app. Optional: most
   * services only ever see the name Synqit gave.
   */
  getPlaylistDetails?: (params: {
    userId: string;
    providerPlaylistId: string;
  }) => Promise<{ name: string | null; description: string | null }>;
};

const spotifyAdapter: ProviderAdapter = {
  id: 'spotify',
  label: 'Spotify',
  isLiveMode: isSpotifyOauthLiveMode,
  listUserPlaylists: async ({ userId, limit, offset }) => {
    const { result } = await withSpotifyAccessTokenRetry({
      userId,
      run: (accessToken) => listSpotifyUserPlaylists({ accessToken, limit, offset }),
    });
    return result;
  },
  listPlaylistTracks: async ({ userId, providerPlaylistId }) => {
    const { result } = await withSpotifyAccessTokenRetry({
      userId,
      run: (accessToken) => listSpotifyPlaylistTracks({ accessToken, providerPlaylistId }),
    });
    return result;
  },
  createPlaylist: async ({ userId, name, description }) => {
    const { result } = await withSpotifyAccessTokenRetry({
      userId,
      run: (accessToken) =>
        createSpotifyPlaylist({ accessToken, name, description: description ?? '' }),
    });
    return result.providerPlaylistId;
  },
  addTracks: async ({ userId, providerPlaylistId, providerTrackIds }) => {
    await withSpotifyAccessTokenRetry({
      userId,
      run: (accessToken) =>
        addSpotifyTracksToPlaylist({
          accessToken,
          providerPlaylistId,
          providerTrackIds: [...providerTrackIds],
        }),
    });
  },
  addTrack: async ({ userId, providerPlaylistId, providerTrackId }) => {
    await withSpotifyAccessTokenRetry({
      userId,
      run: (accessToken) =>
        addSpotifyTrackToPlaylist({ accessToken, providerPlaylistId, providerTrackId }),
    });
  },
  removeTrack: async ({ userId, providerPlaylistId, providerTrackId }) => {
    await withSpotifyAccessTokenRetry({
      userId,
      run: (accessToken) =>
        removeSpotifyTrackFromPlaylist({ accessToken, providerPlaylistId, providerTrackId }),
    });
  },
  searchTracks: async ({ userId, query, limit, offset }) => {
    const { result } = await withSpotifyAccessTokenRetry({
      userId,
      run: (accessToken) =>
        searchSpotifyTracks({ accessToken, query, limit: limit ?? 5, offset: offset ?? 0 }),
    });
    return result;
  },
  findTrackByIsrc: async ({ userId, isrc }) => {
    const { result } = await withSpotifyAccessTokenRetry({
      userId,
      // Spotify has no ISRC endpoint; the search grammar carries the filter.
      run: (accessToken) => searchSpotifyTracks({ accessToken, query: `isrc:${isrc}`, limit: 1 }),
    });
    return result[0] ?? null;
  },
};

const appleAdapter: ProviderAdapter = {
  id: 'apple',
  label: 'Apple Music',
  isLiveMode: isAppleLiveMode,
  listUserPlaylists: ({ userId, limit, offset }) =>
    withAppleMusicUserToken({
      userId,
      run: (ctx) => listAppleLibraryPlaylists({ ...ctx, limit, offset }),
    }),
  listPlaylistTracks: ({ userId, providerPlaylistId }) =>
    withAppleMusicUserToken({
      userId,
      run: (ctx) => listApplePlaylistTracks({ ...ctx, providerPlaylistId }),
    }),
  createPlaylist: ({ userId, name, description }) =>
    withAppleMusicUserToken({
      userId,
      run: async (ctx) => {
        const created = await createAppleLibraryPlaylist({
          ...ctx,
          name,
          description: description ?? '',
        });
        return created.providerPlaylistId;
      },
    }),
  addTracks: async ({ userId, providerPlaylistId, providerTrackIds }) => {
    await withAppleMusicUserToken({
      userId,
      run: (ctx) =>
        addAppleTracksToPlaylist({
          ...ctx,
          providerPlaylistId,
          providerTrackIds: [...providerTrackIds],
        }),
    });
  },
  addTrack: async ({ userId, providerPlaylistId, providerTrackId }) => {
    await withAppleMusicUserToken({
      userId,
      run: (ctx) => addAppleTrackToPlaylist({ ...ctx, providerPlaylistId, providerTrackId }),
    });
  },
  removeTrack: async ({ userId, providerPlaylistId, providerTrackId }) => {
    await withAppleMusicUserToken({
      userId,
      run: (ctx) => removeAppleTrackFromPlaylist({ ...ctx, providerPlaylistId, providerTrackId }),
    });
  },
  searchTracks: ({ userId, query, limit, offset }) =>
    withAppleMusicUserToken({
      userId,
      run: async (ctx) => {
        // The storefront lookup is a separate call that can fail on its own;
        // the configured default keeps search working when it does.
        const storefront = await getAppleUserStorefront(ctx).catch(() => getAppleStorefront());
        return searchAppleCatalogTracks({
          developerToken: ctx.developerToken,
          storefront,
          query,
          limit: limit ?? 5,
          offset: offset ?? 0,
        });
      },
    }),
  getPlaylistDetails: ({ userId, providerPlaylistId }) =>
    withAppleMusicUserToken({
      userId,
      run: (ctx) => getAppleLibraryPlaylist({ ...ctx, providerPlaylistId }),
    }),
  findTrackByIsrc: ({ userId, isrc }) =>
    withAppleMusicUserToken({
      userId,
      run: async (ctx) => {
        const storefront = await getAppleUserStorefront(ctx);
        return findAppleCatalogSongByIsrc({
          developerToken: ctx.developerToken,
          storefront,
          isrc,
        });
      },
    }),
};

const tidalAdapter: ProviderAdapter = {
  id: 'tidal',
  label: 'TIDAL',
  isLiveMode: isTidalOauthLiveMode,
  listUserPlaylists: async ({ userId, limit, offset }) => {
    const { result } = await withTidalAccessTokenRetry({
      userId,
      run: async (accessToken) => {
        const tidalUserId = await getTidalCurrentUserId({ accessToken });
        if (!tidalUserId) {
          return { playlists: [], hasMore: false };
        }
        const playlists = await listTidalUserPlaylists({ accessToken, tidalUserId });
        // TIDAL pages by cursor; the app pages by offset, so slice locally
        // until the picker is moved onto cursors.
        return {
          playlists: playlists.slice(offset, offset + limit),
          hasMore: playlists.length > offset + limit,
        };
      },
    });
    return result;
  },
  listPlaylistTracks: async ({ userId, providerPlaylistId }) => {
    const { result } = await withTidalAccessTokenRetry({
      userId,
      run: (accessToken) => listTidalPlaylistTracks({ accessToken, providerPlaylistId }),
    });
    return result;
  },
  createPlaylist: async ({ userId, name, description }) => {
    const { result } = await withTidalAccessTokenRetry({
      userId,
      run: (accessToken) => createTidalPlaylist({ accessToken, name, description }),
    });
    return result.providerPlaylistId;
  },
  addTracks: async ({ userId, providerPlaylistId, providerTrackIds }) => {
    await withTidalAccessTokenRetry({
      userId,
      run: (accessToken) =>
        addTidalTracksToPlaylist({ accessToken, providerPlaylistId, providerTrackIds }),
    });
  },
  addTrack: async ({ userId, providerPlaylistId, providerTrackId }) => {
    // TIDAL's add throws on refusal already, so one id through it is strict.
    await withTidalAccessTokenRetry({
      userId,
      run: (accessToken) =>
        addTidalTracksToPlaylist({
          accessToken,
          providerPlaylistId,
          providerTrackIds: [providerTrackId],
        }),
    });
  },
  removeTrack: async ({ userId, providerPlaylistId, providerTrackId }) => {
    await withTidalAccessTokenRetry({
      userId,
      run: (accessToken) =>
        removeTidalTrackFromPlaylist({ accessToken, providerPlaylistId, providerTrackId }),
    });
  },
  searchTracks: async ({ userId, query, limit, offset }) => {
    const { result } = await withTidalAccessTokenRetry({
      userId,
      run: (accessToken) => searchTidalTracks({ accessToken, query, limit, offset }),
    });
    return result;
  },
  findTrackByIsrc: async ({ userId, isrc }) => {
    const { result } = await withTidalAccessTokenRetry({
      userId,
      run: (accessToken) => findTidalTrackByIsrc({ accessToken, isrc }),
    });
    return result;
  },
};

const youtubeAdapter: ProviderAdapter = {
  id: 'youtube',
  label: 'YouTube Music',
  isLiveMode: isYoutubeOauthLiveMode,
  listUserPlaylists: async ({ userId, limit, offset }) => {
    const { result } = await withYoutubeAccessTokenRetry({
      userId,
      run: (accessToken) => listYoutubeUserPlaylists({ accessToken, limit, offset }),
    });
    return result;
  },
  listPlaylistTracks: async ({ userId, providerPlaylistId }) => {
    const { result } = await withYoutubeAccessTokenRetry({
      userId,
      run: (accessToken) => listYoutubePlaylistTracks({ accessToken, providerPlaylistId }),
    });
    return result;
  },
  createPlaylist: async ({ userId, name, description }) => {
    const { result } = await withYoutubeAccessTokenRetry({
      userId,
      run: (accessToken) => createYoutubePlaylist({ accessToken, name, description }),
    });
    return result.providerPlaylistId;
  },
  addTracks: async ({ userId, providerPlaylistId, providerTrackIds }) => {
    await withYoutubeAccessTokenRetry({
      userId,
      run: (accessToken) =>
        addYoutubeTracksToPlaylist({ accessToken, providerPlaylistId, providerTrackIds }),
    });
  },
  addTrack: async ({ userId, providerPlaylistId, providerTrackId }) => {
    await withYoutubeAccessTokenRetry({
      userId,
      run: (accessToken) =>
        addYoutubeTrackToPlaylist({ accessToken, providerPlaylistId, providerTrackId }),
    });
  },
  removeTrack: async ({ userId, providerPlaylistId, providerTrackId }) => {
    await withYoutubeAccessTokenRetry({
      userId,
      run: (accessToken) =>
        removeYoutubeTrackFromPlaylist({ accessToken, providerPlaylistId, providerTrackId }),
    });
  },
  searchTracks: async ({ userId, query, limit, offset }) => {
    const { result } = await withYoutubeAccessTokenRetry({
      userId,
      run: (accessToken) => searchYoutubeTracks({ accessToken, query, limit, offset }),
    });
    return result;
  },
  // YouTube exposes no recording ids, so exact matching is impossible; the
  // caller falls back to text search.
  findTrackByIsrc: async () => null,
};

/** Exhaustive by construction: a new Provider fails to compile until added. */
export const PROVIDER_ADAPTERS: Record<Provider, ProviderAdapter> = {
  spotify: spotifyAdapter,
  apple: appleAdapter,
  tidal: tidalAdapter,
  youtube: youtubeAdapter,
};

export const getProviderAdapter = (provider: Provider): ProviderAdapter =>
  PROVIDER_ADAPTERS[provider];

export const getProviderLabel = (provider: Provider): string => PROVIDER_ADAPTERS[provider].label;
