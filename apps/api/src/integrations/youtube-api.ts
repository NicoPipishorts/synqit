import { z } from 'zod';

import { parseIsoDurationMs } from './iso-duration';
import { parseRetryAfterSeconds, ProviderApiError } from './provider-api-error';
import { withProviderRetry } from './provider-throttle';
import { isYoutubePlaceholderTitle, parseYoutubeTitle } from './youtube-titles';

/**
 * YouTube Data API v3, used for YouTube Music. A "track" is a video and a
 * playlist entry is a `playlistItem` that wraps one, so every write goes
 * through the video id and removal first has to find the wrapping item.
 *
 * Quota is the constraint to design around. Each Google project gets 10,000
 * units a day by default: list calls cost 1 unit per page, but `search.list`
 * costs 100 and every insert or delete costs 50. Reading a whole library is
 * cheap; rebuilding one playlist of a hundred tracks on YouTube Music is not,
 * so writes stay sequential and stop at the first quota refusal instead of
 * burning through the day's allowance on failed retries.
 */

const API_BASE_URL = 'https://www.googleapis.com/youtube/v3';
const PAGE_SIZE = 50;
/** Google caps `videos.list` at fifty ids per call. */
const VIDEO_BATCH_SIZE = 50;
/** YouTube playlists hold at most 5,000 videos; stop walking pages there. */
const MAX_PLAYLIST_PAGES = 100;
const MUSIC_CATEGORY_ID = '10';
const PLAYLIST_TITLE_MAX_LENGTH = 150;
const PLAYLIST_DESCRIPTION_MAX_LENGTH = 5000;

const QUOTA_REASONS = new Set(['quotaExceeded', 'dailyLimitExceeded']);
const BURST_REASONS = new Set(['rateLimitExceeded', 'userRateLimitExceeded']);
const MISSING_VIDEO_REASONS = new Set([
  'videoNotFound',
  'forbidden',
  'playlistItemsNotAccessible',
  'invalidVideoId',
]);

export const YOUTUBE_QUOTA_MESSAGE =
  'YouTube API daily quota is exhausted. It resets at midnight Pacific time.';

export type YoutubeTrack = {
  providerTrackId: string;
  name: string;
  artist: string;
  album: string;
  durationMs: number;
  artworkUrl: string | null;
  previewUrl: string | null;
  isrc: string | null;
};

export type YoutubePlaylist = {
  providerPlaylistId: string;
  name: string;
  trackCount: number | null;
  coverImageUrl: string | null;
};

const thumbnailsSchema = z
  .record(z.string(), z.object({ url: z.string().optional() }).passthrough())
  .optional();

const errorPayloadSchema = z.object({
  error: z
    .object({
      code: z.number().optional(),
      message: z.string().optional(),
      errors: z
        .array(z.object({ reason: z.string().optional(), message: z.string().optional() }))
        .optional(),
    })
    .optional(),
});

const playlistListSchema = z.object({
  nextPageToken: z.string().optional(),
  items: z
    .array(
      z.object({
        id: z.string(),
        snippet: z
          .object({ title: z.string().optional(), thumbnails: thumbnailsSchema })
          .optional(),
        contentDetails: z.object({ itemCount: z.number().optional() }).optional(),
      }),
    )
    .optional()
    .default([]),
});

const playlistItemListSchema = z.object({
  nextPageToken: z.string().optional(),
  items: z
    .array(
      z.object({
        id: z.string(),
        snippet: z
          .object({
            title: z.string().optional(),
            videoOwnerChannelTitle: z.string().optional(),
            thumbnails: thumbnailsSchema,
            resourceId: z.object({ videoId: z.string().optional() }).optional(),
          })
          .optional(),
        contentDetails: z.object({ videoId: z.string().optional() }).optional(),
      }),
    )
    .optional()
    .default([]),
});

const videoListSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        contentDetails: z.object({ duration: z.string().optional() }).optional(),
      }),
    )
    .optional()
    .default([]),
});

const searchListSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.object({ videoId: z.string().optional() }).optional(),
        snippet: z
          .object({
            title: z.string().optional(),
            channelTitle: z.string().optional(),
            thumbnails: thumbnailsSchema,
          })
          .optional(),
      }),
    )
    .optional()
    .default([]),
});

const createdResourceSchema = z.object({ id: z.string().min(1) });

const readErrorReason = (payload: unknown): string | null => {
  const parsed = errorPayloadSchema.safeParse(payload);
  return parsed.success ? (parsed.data.error?.errors?.[0]?.reason ?? null) : null;
};

/** True for the daily quota refusal, which no amount of retrying will clear today. */
export const isYoutubeQuotaError = (error: unknown): boolean =>
  error instanceof ProviderApiError &&
  error.provider === 'youtube' &&
  QUOTA_REASONS.has(readErrorReason(error.details) ?? '');

const readThumbnail = (thumbnails: z.infer<typeof thumbnailsSchema>): string | null =>
  thumbnails?.medium?.url ?? thumbnails?.high?.url ?? thumbnails?.default?.url ?? null;

const toTrack = (params: {
  videoId: string;
  title: string;
  channelTitle: string | null;
  thumbnails: z.infer<typeof thumbnailsSchema>;
  durationMs: number;
}): YoutubeTrack => {
  const parsed = parseYoutubeTitle(params.title, params.channelTitle);
  return {
    providerTrackId: params.videoId,
    name: parsed.name,
    artist: parsed.artist || 'Unknown artist',
    // Videos carry no album; the matcher searches on name and artist anyway.
    album: '',
    durationMs: params.durationMs,
    artworkUrl: readThumbnail(params.thumbnails),
    previewUrl: null,
    isrc: null,
  };
};

const request = async (params: {
  accessToken: string;
  path: string;
  method?: 'GET' | 'POST' | 'DELETE';
  query?: Record<string, string | undefined>;
  body?: unknown;
  action: string;
}): Promise<unknown> => {
  const url = new URL(`${API_BASE_URL}${params.path}`);
  for (const [key, value] of Object.entries(params.query ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = {
    authorization: `Bearer ${params.accessToken}`,
    accept: 'application/json',
  };
  if (params.body !== undefined) {
    headers['content-type'] = 'application/json';
  }

  const response = await fetch(url.toString(), {
    method: params.method ?? 'GET',
    headers,
    body: params.body === undefined ? undefined : JSON.stringify(params.body),
  });

  if (response.status === 204) {
    return {};
  }

  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    const reason = readErrorReason(payload);
    // Per-second bursts come back as 403 too. Report them as 429 so the shared
    // backoff retries them; the daily quota refusal keeps its 403 and is final.
    const isBurst = reason !== null && BURST_REASONS.has(reason);
    const isQuota = reason !== null && QUOTA_REASONS.has(reason);
    throw new ProviderApiError({
      provider: 'youtube',
      statusCode: isBurst ? 429 : response.status,
      message: isQuota
        ? YOUTUBE_QUOTA_MESSAGE
        : `YouTube ${params.action} failed with status ${response.status}.`,
      details: payload,
      retryAfterSeconds: parseRetryAfterSeconds(response.headers.get('retry-after')),
    });
  }

  return payload;
};

/** Durations live on the video, not the playlist item: one extra unit per fifty tracks. */
const fetchVideoDurations = async (params: {
  accessToken: string;
  videoIds: readonly string[];
}): Promise<Map<string, number>> => {
  const durations = new Map<string, number>();
  for (let index = 0; index < params.videoIds.length; index += VIDEO_BATCH_SIZE) {
    const batch = params.videoIds.slice(index, index + VIDEO_BATCH_SIZE);
    const payload = videoListSchema.parse(
      await request({
        accessToken: params.accessToken,
        path: '/videos',
        query: {
          part: 'contentDetails',
          id: batch.join(','),
          maxResults: String(VIDEO_BATCH_SIZE),
        },
        action: 'video_details',
      }),
    );
    for (const video of payload.items) {
      durations.set(video.id, parseIsoDurationMs(video.contentDetails?.duration));
    }
  }
  return durations;
};

/**
 * The signed-in user's playlists. YouTube pages by token and the app by offset,
 * so walk just far enough to fill the requested window and learn whether more
 * exist; each page is one unit.
 */
export const listYoutubeUserPlaylists = async (params: {
  accessToken: string;
  limit: number;
  offset: number;
}): Promise<{ playlists: YoutubePlaylist[]; hasMore: boolean }> => {
  const wanted = params.offset + params.limit + 1;
  const collected: YoutubePlaylist[] = [];
  let pageToken: string | undefined;
  do {
    const payload = playlistListSchema.parse(
      await request({
        accessToken: params.accessToken,
        path: '/playlists',
        query: {
          part: 'snippet,contentDetails',
          mine: 'true',
          maxResults: String(PAGE_SIZE),
          pageToken,
        },
        action: 'list_playlists',
      }),
    );
    for (const item of payload.items) {
      collected.push({
        providerPlaylistId: item.id,
        name: item.snippet?.title?.trim() || 'Untitled playlist',
        trackCount: item.contentDetails?.itemCount ?? null,
        coverImageUrl: readThumbnail(item.snippet?.thumbnails),
      });
    }
    pageToken = payload.nextPageToken;
  } while (pageToken && collected.length < wanted);

  return {
    playlists: collected.slice(params.offset, params.offset + params.limit),
    hasMore: collected.length > params.offset + params.limit,
  };
};

export const listYoutubePlaylistTracks = async (params: {
  accessToken: string;
  providerPlaylistId: string;
}): Promise<YoutubeTrack[]> => {
  const entries: Array<Omit<YoutubeTrack, 'durationMs'>> = [];
  let pageToken: string | undefined;
  let pages = 0;
  do {
    const payload = playlistItemListSchema.parse(
      await request({
        accessToken: params.accessToken,
        path: '/playlistItems',
        query: {
          part: 'snippet,contentDetails',
          playlistId: params.providerPlaylistId,
          maxResults: String(PAGE_SIZE),
          pageToken,
        },
        action: 'list_playlist_tracks',
      }),
    );
    for (const item of payload.items) {
      const videoId = item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId;
      const title = item.snippet?.title?.trim();
      if (!videoId || !title || isYoutubePlaceholderTitle(title)) {
        continue;
      }
      entries.push(
        toTrack({
          videoId,
          title,
          channelTitle: item.snippet?.videoOwnerChannelTitle ?? null,
          thumbnails: item.snippet?.thumbnails,
          durationMs: 0,
        }),
      );
    }
    pageToken = payload.nextPageToken;
    pages += 1;
  } while (pageToken && pages < MAX_PLAYLIST_PAGES);

  const durations = await fetchVideoDurations({
    accessToken: params.accessToken,
    videoIds: entries.map((entry) => entry.providerTrackId),
  });
  return entries.map((entry) => ({
    ...entry,
    durationMs: durations.get(entry.providerTrackId) ?? 0,
  }));
};

/** Text search in the music category. 100 units a call, so callers keep `limit` small. */
export const searchYoutubeTracks = async (params: {
  accessToken: string;
  query: string;
  limit?: number;
}): Promise<YoutubeTrack[]> => {
  const payload = searchListSchema.parse(
    await request({
      accessToken: params.accessToken,
      path: '/search',
      query: {
        part: 'snippet',
        type: 'video',
        videoCategoryId: MUSIC_CATEGORY_ID,
        q: params.query,
        maxResults: String(Math.min(Math.max(params.limit ?? 5, 1), PAGE_SIZE)),
      },
      action: 'search',
    }),
  );

  const hits = payload.items.flatMap((item) => {
    const videoId = item.id?.videoId;
    const title = item.snippet?.title?.trim();
    return videoId && title
      ? [
          {
            videoId,
            title,
            channelTitle: item.snippet?.channelTitle ?? null,
            thumbnails: item.snippet?.thumbnails,
          },
        ]
      : [];
  });
  if (hits.length === 0) {
    return [];
  }

  const durations = await fetchVideoDurations({
    accessToken: params.accessToken,
    videoIds: hits.map((hit) => hit.videoId),
  });
  return hits.map((hit) => toTrack({ ...hit, durationMs: durations.get(hit.videoId) ?? 0 }));
};

export const createYoutubePlaylist = async (params: {
  accessToken: string;
  name: string;
  description?: string;
}): Promise<{ providerPlaylistId: string }> => {
  const payload = createdResourceSchema.safeParse(
    await request({
      accessToken: params.accessToken,
      path: '/playlists',
      method: 'POST',
      query: { part: 'snippet,status' },
      body: {
        snippet: {
          title: params.name.slice(0, PLAYLIST_TITLE_MAX_LENGTH),
          description: (params.description ?? '').slice(0, PLAYLIST_DESCRIPTION_MAX_LENGTH),
        },
        status: { privacyStatus: 'private' },
      },
      action: 'create_playlist',
    }),
  );
  if (!payload.success) {
    throw new ProviderApiError({
      provider: 'youtube',
      statusCode: 502,
      message: 'YouTube did not return the created playlist.',
    });
  }
  return { providerPlaylistId: payload.data.id };
};

/**
 * One insert per video, in order: the API has no batch form and parallel
 * inserts reorder the playlist. A video YouTube refuses (removed, blocked in
 * the user's region) is skipped; anything else stops the run so the caller can
 * record what did land and resume later.
 */
export const addYoutubeTracksToPlaylist = async (params: {
  accessToken: string;
  providerPlaylistId: string;
  providerTrackIds: readonly string[];
  /** Called after each successful insert, so a caller can checkpoint before a failure. */
  onAdded?: (providerTrackId: string) => void;
}): Promise<{ addedTrackIds: string[] }> => {
  const addedTrackIds: string[] = [];
  for (const videoId of params.providerTrackIds) {
    try {
      await withProviderRetry(() =>
        request({
          accessToken: params.accessToken,
          path: '/playlistItems',
          method: 'POST',
          query: { part: 'snippet' },
          body: {
            snippet: {
              playlistId: params.providerPlaylistId,
              resourceId: { kind: 'youtube#video', videoId },
            },
          },
          action: 'add_track',
        }),
      );
      addedTrackIds.push(videoId);
      params.onAdded?.(videoId);
    } catch (error) {
      const reason = error instanceof ProviderApiError ? readErrorReason(error.details) : null;
      if (
        error instanceof ProviderApiError &&
        !isYoutubeQuotaError(error) &&
        (error.statusCode === 404 || (reason !== null && MISSING_VIDEO_REASONS.has(reason)))
      ) {
        continue;
      }
      throw error;
    }
  }
  return { addedTrackIds };
};

export const removeYoutubeTrackFromPlaylist = async (params: {
  accessToken: string;
  providerPlaylistId: string;
  providerTrackId: string;
}): Promise<void> => {
  // Deletion is by playlist item, so resolve the entry that wraps this video.
  const lookup = playlistItemListSchema.parse(
    await request({
      accessToken: params.accessToken,
      path: '/playlistItems',
      query: {
        part: 'id',
        playlistId: params.providerPlaylistId,
        videoId: params.providerTrackId,
        maxResults: '1',
      },
      action: 'find_playlist_item',
    }),
  );
  const item = lookup.items[0];
  if (!item) {
    throw new ProviderApiError({
      provider: 'youtube',
      statusCode: 404,
      message: 'Track is not in this YouTube playlist.',
    });
  }

  await request({
    accessToken: params.accessToken,
    path: '/playlistItems',
    method: 'DELETE',
    query: { id: item.id },
    action: 'remove_track',
  });
};
