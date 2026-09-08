import { eventProviderSchema } from '@synqit/shared';
import type { Provider, ProviderPlaylistItem } from '@synqit/shared';

import { isAppleLiveMode } from './apple';
import { withAppleMusicUserToken } from './apple-client';
import {
  addAppleTracksToPlaylist,
  createAppleLibraryPlaylist,
  findAppleCatalogSongByIsrc,
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

/**
 * One shape for every music service the app writes to.
 *
 * Before this existed, each new provider meant an `if (provider === 'spotify')`
 * in nine files. Callers now ask the registry for an adapter and the provider
 * list is a compile-time exhaustive record, so adding a service is additive.
 *
 * Each adapter takes a `userId` and resolves its own credentials, because the
 * three services authenticate differently: Spotify refreshes an OAuth token,
 * Apple pairs a developer token with a music-user token, TIDAL uses PKCE.
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
  /**
   * Whether guests can build an event playlist on this service. Event hosting
   * needs the provider-specific guest search and moderation paths in
   * events/routes.ts, which still cover Spotify and Apple Music only.
   */
  supportsEvents: boolean;
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
  addTracks: (params: {
    userId: string;
    providerPlaylistId: string;
    providerTrackIds: readonly string[];
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
  }) => Promise<ProviderTrack[]>;
  /** Exact lookup; null when the service cannot do it or has no match. */
  findTrackByIsrc: (params: { userId: string; isrc: string }) => Promise<ProviderTrack | null>;
};

const spotifyAdapter: ProviderAdapter = {
  id: 'spotify',
  label: 'Spotify',
  isLiveMode: isSpotifyOauthLiveMode,
  supportsEvents: true,
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
  removeTrack: async ({ userId, providerPlaylistId, providerTrackId }) => {
    await withSpotifyAccessTokenRetry({
      userId,
      run: (accessToken) =>
        removeSpotifyTrackFromPlaylist({ accessToken, providerPlaylistId, providerTrackId }),
    });
  },
  searchTracks: async ({ userId, query, limit }) => {
    const { result } = await withSpotifyAccessTokenRetry({
      userId,
      run: (accessToken) => searchSpotifyTracks({ accessToken, query, limit: limit ?? 5 }),
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
  supportsEvents: true,
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
  removeTrack: async ({ userId, providerPlaylistId, providerTrackId }) => {
    await withAppleMusicUserToken({
      userId,
      run: (ctx) => removeAppleTrackFromPlaylist({ ...ctx, providerPlaylistId, providerTrackId }),
    });
  },
  searchTracks: ({ userId, query, limit }) =>
    withAppleMusicUserToken({
      userId,
      run: async (ctx) => {
        const storefront = await getAppleUserStorefront(ctx);
        return searchAppleCatalogTracks({
          developerToken: ctx.developerToken,
          storefront,
          query,
          limit: limit ?? 5,
        });
      },
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
  supportsEvents: false,
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
  removeTrack: async ({ userId, providerPlaylistId, providerTrackId }) => {
    await withTidalAccessTokenRetry({
      userId,
      run: (accessToken) =>
        removeTidalTrackFromPlaylist({ accessToken, providerPlaylistId, providerTrackId }),
    });
  },
  searchTracks: async ({ userId, query, limit }) => {
    const { result } = await withTidalAccessTokenRetry({
      userId,
      run: (accessToken) => searchTidalTracks({ accessToken, query, limit }),
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

/** Exhaustive by construction: a new Provider fails to compile until added. */
export const PROVIDER_ADAPTERS: Record<Provider, ProviderAdapter> = {
  spotify: spotifyAdapter,
  apple: appleAdapter,
  tidal: tidalAdapter,
};

export const getProviderAdapter = (provider: Provider): ProviderAdapter =>
  PROVIDER_ADAPTERS[provider];

export const getProviderLabel = (provider: Provider): string => PROVIDER_ADAPTERS[provider].label;

/** Services a guest can add to via a magic link today. */
export const EVENT_CAPABLE_PROVIDERS: Provider[] = Object.values(PROVIDER_ADAPTERS)
  .filter((adapter) => adapter.supportsEvents)
  .map((adapter) => adapter.id);

/**
 * The adapters and the shared `eventProviderSchema` the frontends read must agree, or the
 * event creation flow would offer a provider the API then rejects. Assert it at boot rather
 * than discovering it when a host picks the wrong logo.
 */
const declaredEventProviders = new Set<string>(eventProviderSchema.options);
const adapterEventProviders = new Set<string>(EVENT_CAPABLE_PROVIDERS);
if (
  declaredEventProviders.size !== adapterEventProviders.size ||
  EVENT_CAPABLE_PROVIDERS.some((provider) => !declaredEventProviders.has(provider))
) {
  throw new Error(
    `Event-capable providers disagree: adapters say [${[...adapterEventProviders].sort().join(', ')}], ` +
      `eventProviderSchema says [${[...declaredEventProviders].sort().join(', ')}]`,
  );
}
