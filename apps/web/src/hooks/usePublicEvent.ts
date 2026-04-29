import {
  addEventTrackResponseSchema,
  eventPublicResponseSchema,
  eventTrackSearchResponseSchema,
  eventTracksResponseSchema,
} from '@synqit/shared';
import { useQueryClient } from '@tanstack/react-query';
import { FormEvent, useCallback, useEffect, useState } from 'react';

import { useI18n } from './useI18n';
import { useToast } from './useToast';
import { trackAnalyticsEvent } from '../lib/analytics';
import { callApi, toApiError } from '../lib/api';
import { toApiAssetUrl } from '../lib/apiAssetUrl';
import {
  EventCloseReason,
  EventProvider,
  EventStatus,
  EventTrackItem,
  ProviderConnectionStatus,
} from '../lib/events';
import { trackEvent as trackPublicEvent, untrackEvent as untrackPublicEvent } from '../lib/queries';

export type SearchTrackResult = {
  providerTrackId: string;
  name: string;
  artist: string;
  album: string;
  durationMs: number;
  artworkUrl: string | null;
  previewUrl: string | null;
};

type EventData = {
  name: string;
  description: string;
  status: EventStatus;
  closeReason: EventCloseReason | null;
  connectionStatus: ProviderConnectionStatus;
  provider: EventProvider;
  coverImageUrl: string | null;
  isOwner: boolean;
  isTracked: boolean;
};

const ADDED_TRACKS_PAGE_SIZE = 12;
const SEARCH_FETCH_LIMIT = 25;
const MAX_SEARCH_RESULTS = 50;

export { ADDED_TRACKS_PAGE_SIZE };

export const usePublicEvent = (magicLinkToken: string, accessToken?: string | null) => {
  const { t } = useI18n();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [pageError, setPageError] = useState<string | null>(null);
  const [event, setEvent] = useState<EventData | null>(null);
  const [tracks, setTracks] = useState<EventTrackItem[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [searchResults, setSearchResults] = useState<SearchTrackResult[]>([]);
  const [activeTab, setActiveTab] = useState<'results' | 'added'>('results');
  const [hasSearched, setHasSearched] = useState(false);
  const [hasMoreSearchResults, setHasMoreSearchResults] = useState(false);
  const [visibleAddedTracksCount, setVisibleAddedTracksCount] = useState(ADDED_TRACKS_PAGE_SIZE);

  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMoreSearchResults, setIsLoadingMoreSearchResults] = useState(false);
  const [addingTrackId, setAddingTrackId] = useState<string | null>(null);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [isTrackMutationPending, setIsTrackMutationPending] = useState(false);

  const getPublicErrorMessage = useCallback(
    (code: string, fallbackMessage: string) => {
      if (code === 'provider_playlist_missing') {
        return t('eventPublicPage.statusPlaylistDeleted');
      }
      return t('eventsPage.error', { message: fallbackMessage });
    },
    [t],
  );

  const applyProviderPlaylistMissingState = useCallback(() => {
    setEvent((prev) =>
      prev ? { ...prev, status: 'closed', closeReason: 'provider_playlist_missing' } : prev,
    );
    setTracks([]);
    setSearchResults([]);
    setHasMoreSearchResults(false);
    setActiveTab('added');
  }, []);

  const loadTracks = useCallback(async () => {
    setIsLoadingTracks(true);
    try {
      const result = await callApi(
        `/v1/playlists/link/${encodeURIComponent(magicLinkToken)}/tracks`,
        { method: 'GET' },
        (payload) => eventTracksResponseSchema.parse(payload),
      );
      setTracks(result.tracks);
      setVisibleAddedTracksCount((c) => Math.max(c, ADDED_TRACKS_PAGE_SIZE));
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.code === 'provider_playlist_missing') applyProviderPlaylistMissingState();
      const message = getPublicErrorMessage(apiError.code, apiError.message);
      setPageError(message);
      showToast(message, { variant: 'error' });
      trackAnalyticsEvent({
        eventName: 'event_tracks_load_failed',
        target: 'events',
        properties: { scope: 'public', code: apiError.code },
      });
    } finally {
      setIsLoadingTracks(false);
    }
  }, [applyProviderPlaylistMissingState, getPublicErrorMessage, magicLinkToken, showToast]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setPageError(null);
      try {
        const [eventResult, tracksResult] = await Promise.all([
          callApi(
            `/v1/playlists/link/${encodeURIComponent(magicLinkToken)}`,
            {
              method: 'GET',
              headers: accessToken ? { authorization: `Bearer ${accessToken}` } : undefined,
            },
            (payload) => eventPublicResponseSchema.parse(payload),
          ),
          callApi(
            `/v1/playlists/link/${encodeURIComponent(magicLinkToken)}/tracks`,
            { method: 'GET' },
            (payload) => eventTracksResponseSchema.parse(payload),
          ),
        ]);
        setEvent({
          name: eventResult.event.name,
          description: eventResult.event.description,
          status: eventResult.event.status,
          closeReason: eventResult.event.closeReason ?? null,
          connectionStatus: eventResult.event.providerConnectionStatus,
          provider: eventResult.event.provider,
          coverImageUrl: toApiAssetUrl(eventResult.event.coverImageUrl),
          isOwner: eventResult.event.isOwner,
          isTracked: eventResult.event.isTracked,
        });
        setTracks(tracksResult.tracks);
        setVisibleAddedTracksCount(ADDED_TRACKS_PAGE_SIZE);
      } catch (error) {
        const apiError = toApiError(error);
        if (apiError.code === 'provider_playlist_missing') applyProviderPlaylistMissingState();
        const message = getPublicErrorMessage(apiError.code, apiError.message);
        setPageError(message);
        showToast(message, { variant: 'error' });
        trackAnalyticsEvent({
          eventName: 'event_public_load_failed',
          target: 'events',
          properties: { code: apiError.code },
        });
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [
    accessToken,
    applyProviderPlaylistMissingState,
    getPublicErrorMessage,
    magicLinkToken,
    showToast,
  ]);

  const fetchSearchBatch = useCallback(
    async (queryText: string, offset: number): Promise<SearchTrackResult[]> => {
      const query = new URLSearchParams({
        q: queryText,
        limit: String(SEARCH_FETCH_LIMIT),
        offset: String(offset),
      });
      const result = await callApi(
        `/v1/playlists/link/${encodeURIComponent(magicLinkToken)}/search?${query.toString()}`,
        { method: 'GET' },
        (payload) => eventTrackSearchResponseSchema.parse(payload),
      );
      return result.results;
    },
    [magicLinkToken],
  );

  const onSearch = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (event?.status !== 'open') {
      setSearchStatus(
        event?.closeReason === 'provider_playlist_missing'
          ? t('eventPublicPage.statusPlaylistDeleted')
          : t('eventPublicPage.statusEventClosed'),
      );
      trackAnalyticsEvent({
        eventName: 'event_track_add_blocked',
        target: 'events',
        properties: { scope: 'public', reason: 'event_closed', action: 'search' },
      });
      return;
    }
    const nextQuery = searchQuery.trim();
    if (nextQuery.length < 2) {
      setSearchStatus(t('eventPublicPage.minChars'));
      return;
    }
    setIsSearching(true);
    try {
      const firstBatch = await fetchSearchBatch(nextQuery, 0);
      setSearchResults(firstBatch);
      setHasMoreSearchResults(
        firstBatch.length === SEARCH_FETCH_LIMIT && firstBatch.length < MAX_SEARCH_RESULTS,
      );
      setSearchStatus(
        firstBatch.length > 0
          ? t('eventPublicPage.searchFound', { count: firstBatch.length })
          : t('eventPublicPage.noResults'),
      );
      setHasSearched(true);
      setActiveTab('results');
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.code === 'provider_playlist_missing') applyProviderPlaylistMissingState();
      const message = getPublicErrorMessage(apiError.code, apiError.message);
      setSearchStatus(message);
      showToast(message, { variant: 'error' });
      trackAnalyticsEvent({
        eventName: 'event_track_search_failed',
        target: 'events',
        properties: { code: apiError.code },
      });
    } finally {
      setIsSearching(false);
    }
  };

  const loadMoreSearchResults = async () => {
    if (isLoadingMoreSearchResults || isSearching) return;
    const nextQuery = searchQuery.trim();
    if (nextQuery.length < 2) {
      setSearchStatus(t('eventPublicPage.minChars'));
      return;
    }
    const offset = searchResults.length;
    if (offset >= MAX_SEARCH_RESULTS) {
      setHasMoreSearchResults(false);
      return;
    }
    setIsLoadingMoreSearchResults(true);
    try {
      const nextBatch = await fetchSearchBatch(nextQuery, offset);
      const merged = [...searchResults, ...nextBatch].slice(0, MAX_SEARCH_RESULTS);
      setSearchResults(merged);
      setHasMoreSearchResults(
        nextBatch.length === SEARCH_FETCH_LIMIT && merged.length < MAX_SEARCH_RESULTS,
      );
      setSearchStatus(
        merged.length > 0
          ? t('eventPublicPage.searchFound', { count: merged.length })
          : t('eventPublicPage.noResults'),
      );
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.code === 'provider_playlist_missing') applyProviderPlaylistMissingState();
      const message = getPublicErrorMessage(apiError.code, apiError.message);
      setSearchStatus(message);
      showToast(message, { variant: 'error' });
      trackAnalyticsEvent({
        eventName: 'event_track_search_failed',
        target: 'events',
        properties: { code: apiError.code, action: 'load_more' },
      });
    } finally {
      setIsLoadingMoreSearchResults(false);
    }
  };

  const addTrack = async (track: SearchTrackResult) => {
    if (event?.status !== 'open') {
      setSearchStatus(
        event?.closeReason === 'provider_playlist_missing'
          ? t('eventPublicPage.statusPlaylistDeleted')
          : t('eventPublicPage.statusEventClosed'),
      );
      trackAnalyticsEvent({
        eventName: 'event_track_add_blocked',
        target: 'events',
        properties: {
          scope: 'public',
          reason: 'event_closed',
          providerTrackId: track.providerTrackId,
        },
      });
      return;
    }
    setAddingTrackId(track.providerTrackId);
    try {
      const result = await callApi(
        `/v1/playlists/link/${encodeURIComponent(magicLinkToken)}/tracks`,
        { method: 'POST', body: JSON.stringify(track) },
        (payload) => addEventTrackResponseSchema.parse(payload),
      );
      setTracks((prev) => [
        result.track,
        ...prev.filter((t) => t.providerTrackId !== result.track.providerTrackId),
      ]);
      setSearchStatus(t('eventPublicPage.addedToPlaylist', { name: result.track.name }));
      showToast(t('eventPublicPage.addedToast', { name: result.track.name }), {
        variant: 'success',
      });
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.code === 'provider_playlist_missing') applyProviderPlaylistMissingState();
      const message = getPublicErrorMessage(apiError.code, apiError.message);
      setSearchStatus(message);
      showToast(message, { variant: 'error' });
      trackAnalyticsEvent({
        eventName: 'event_track_add_failed',
        target: 'events',
        properties: { code: apiError.code, providerTrackId: track.providerTrackId },
      });
    } finally {
      setAddingTrackId(null);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setHasSearched(false);
    setSearchStatus('');
    setHasMoreSearchResults(false);
  };

  const toggleTracked = async () => {
    if (!accessToken || !event || event.isOwner || isTrackMutationPending) {
      return;
    }

    setIsTrackMutationPending(true);
    try {
      if (event.isTracked) {
        await untrackPublicEvent(magicLinkToken);
        setEvent((prev) => (prev ? { ...prev, isTracked: false } : prev));
        showToast(t('eventPublicPage.untrackSuccess'), { variant: 'success' });
      } else {
        await trackPublicEvent(magicLinkToken);
        setEvent((prev) => (prev ? { ...prev, isTracked: true } : prev));
        showToast(t('eventPublicPage.trackSuccess'), { variant: 'success' });
      }
      await queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
    } catch (error) {
      const apiError = toApiError(error);
      showToast(t('eventPublicPage.trackError', { message: apiError.message }), {
        variant: 'error',
      });
    } finally {
      setIsTrackMutationPending(false);
    }
  };

  return {
    // event data
    event,
    pageError,
    tracks,
    isLoading,
    isTrackMutationPending,
    // tabs
    activeTab,
    setActiveTab,
    // search
    searchQuery,
    setSearchQuery,
    searchStatus,
    searchResults,
    hasSearched,
    hasMoreSearchResults,
    isSearching,
    isLoadingMoreSearchResults,
    addingTrackId,
    onSearch,
    loadMoreSearchResults,
    addTrack,
    clearSearch,
    toggleTracked,
    // added tracks
    visibleAddedTracksCount,
    setVisibleAddedTracksCount,
    isLoadingTracks,
    loadTracks,
  };
};
