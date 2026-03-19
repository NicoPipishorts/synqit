import {
  addEventTrackResponseSchema,
  eventPublicResponseSchema,
  eventTrackSearchResponseSchema,
  eventTracksResponseSchema,
} from '@synqit/shared';
import { useParams } from '@tanstack/react-router';
import { Check, ListMusic, LoaderCircle, Plus, RefreshCcw, Search, X } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';

import { EventStatusIndicator } from '../components/events/EventStatusIndicator';
import { HomeFooterReveal } from '../components/marketing/HomeFooterReveal';
import { BlurSpotLayer } from '../components/shell/BackgroundBlurSpots';
import { CTAButton } from '../components/ui/cta';
import { LanguageSwitcher } from '../components/ui/LanguageSwitcher';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { useI18n } from '../hooks/useI18n';
import { useToast } from '../hooks/useToast';
import { trackAnalyticsEvent } from '../lib/analytics';
import { callApi, toApiError } from '../lib/api';
import { toApiAssetUrl } from '../lib/apiAssetUrl';
import {
  EventProvider,
  EventStatus,
  EventTrackItem,
  ProviderConnectionStatus,
} from '../lib/events';

type SearchTrackResult = {
  providerTrackId: string;
  name: string;
  artist: string;
  album: string;
  durationMs: number;
  artworkUrl: string | null;
};

type InviteeTab = 'results' | 'added';

const ADDED_TRACKS_PAGE_SIZE = 12;
const SEARCH_FETCH_LIMIT = 25;
const MAX_SEARCH_RESULTS = 50;

export const EventPublicPage = () => {
  const params = useParams({ from: '/playlist/$magicLinkToken' });
  const { t } = useI18n();
  const { showToast } = useToast();

  const [pageError, setPageError] = useState<string | null>(null);
  const [eventName, setEventName] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventState, setEventState] = useState<EventStatus | null>(null);
  const [eventConnectionStatus, setEventConnectionStatus] =
    useState<ProviderConnectionStatus | null>(null);
  const [eventProvider, setEventProvider] = useState<EventProvider | null>(null);
  const [eventCoverImageUrl, setEventCoverImageUrl] = useState<string | null>(null);
  const [tracks, setTracks] = useState<EventTrackItem[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [searchResults, setSearchResults] = useState<SearchTrackResult[]>([]);
  const [activeTab, setActiveTab] = useState<InviteeTab>('results');
  const [hasSearched, setHasSearched] = useState(false);
  const [hasMoreSearchResults, setHasMoreSearchResults] = useState(false);
  const [visibleAddedTracksCount, setVisibleAddedTracksCount] = useState(ADDED_TRACKS_PAGE_SIZE);

  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMoreSearchResults, setIsLoadingMoreSearchResults] = useState(false);
  const [addingTrackId, setAddingTrackId] = useState<string | null>(null);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);

  const loadTracks = useCallback(async () => {
    setIsLoadingTracks(true);
    try {
      const result = await callApi(
        `/v1/playlists/link/${encodeURIComponent(params.magicLinkToken)}/tracks`,
        {
          method: 'GET',
        },
        (payload) => eventTracksResponseSchema.parse(payload),
      );
      setTracks(result.tracks);
      setVisibleAddedTracksCount((currentCount) => Math.max(currentCount, ADDED_TRACKS_PAGE_SIZE));
    } catch (error) {
      const apiError = toApiError(error);
      const message = t('eventsPage.error', { message: apiError.message });
      setPageError(message);
      showToast(message, { variant: 'error' });
      trackAnalyticsEvent({
        eventName: 'event_tracks_load_failed',
        target: 'events',
        properties: {
          scope: 'public',
          code: apiError.code,
        },
      });
    } finally {
      setIsLoadingTracks(false);
    }
  }, [params.magicLinkToken, showToast, t]);

  useEffect(() => {
    const loadEventAndTracks = async () => {
      setIsLoading(true);
      setPageError(null);
      try {
        const [eventResult, tracksResult] = await Promise.all([
          callApi(
            `/v1/playlists/link/${encodeURIComponent(params.magicLinkToken)}`,
            {
              method: 'GET',
            },
            (payload) => eventPublicResponseSchema.parse(payload),
          ),
          callApi(
            `/v1/playlists/link/${encodeURIComponent(params.magicLinkToken)}/tracks`,
            {
              method: 'GET',
            },
            (payload) => eventTracksResponseSchema.parse(payload),
          ),
        ]);

        setEventName(eventResult.event.name);
        setEventDescription(eventResult.event.description);
        setEventState(eventResult.event.status);
        setEventConnectionStatus(eventResult.event.providerConnectionStatus);
        setEventProvider(eventResult.event.provider);
        setEventCoverImageUrl(toApiAssetUrl(eventResult.event.coverImageUrl));
        setTracks(tracksResult.tracks);
        setVisibleAddedTracksCount(ADDED_TRACKS_PAGE_SIZE);
      } catch (error) {
        const apiError = toApiError(error);
        const message = t('eventsPage.error', { message: apiError.message });
        setPageError(message);
        showToast(message, { variant: 'error' });
        trackAnalyticsEvent({
          eventName: 'event_public_load_failed',
          target: 'events',
          properties: {
            code: apiError.code,
          },
        });
      } finally {
        setIsLoading(false);
      }
    };

    void loadEventAndTracks();
  }, [params.magicLinkToken, showToast, t]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const robotsMeta = document.createElement('meta');
    robotsMeta.name = 'robots';
    robotsMeta.content = 'noindex, nofollow, noarchive, nosnippet';
    robotsMeta.dataset.synqitRoute = 'event-public';

    const googlebotMeta = document.createElement('meta');
    googlebotMeta.name = 'googlebot';
    googlebotMeta.content = 'noindex, nofollow, noarchive, nosnippet';
    googlebotMeta.dataset.synqitRoute = 'event-public';

    document.head.append(robotsMeta, googlebotMeta);

    return () => {
      robotsMeta.remove();
      googlebotMeta.remove();
    };
  }, []);

  const fetchSearchBatch = useCallback(
    async (queryText: string, offset: number): Promise<SearchTrackResult[]> => {
      const query = new URLSearchParams({
        q: queryText,
        limit: String(SEARCH_FETCH_LIMIT),
        offset: String(offset),
      });
      const result = await callApi(
        `/v1/playlists/link/${encodeURIComponent(params.magicLinkToken)}/search?${query.toString()}`,
        {
          method: 'GET',
        },
        (payload) => eventTrackSearchResponseSchema.parse(payload),
      );
      return result.results;
    },
    [params.magicLinkToken],
  );

  const onSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (eventState !== 'open') {
      setSearchStatus(t('eventPublicPage.statusEventClosed'));
      trackAnalyticsEvent({
        eventName: 'event_track_add_blocked',
        target: 'events',
        properties: {
          scope: 'public',
          reason: 'event_closed',
          action: 'search',
        },
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
      const message = t('eventsPage.error', { message: apiError.message });
      setSearchStatus(message);
      showToast(message, { variant: 'error' });
      trackAnalyticsEvent({
        eventName: 'event_track_search_failed',
        target: 'events',
        properties: {
          code: apiError.code,
        },
      });
    } finally {
      setIsSearching(false);
    }
  };

  const loadMoreSearchResults = async () => {
    if (isLoadingMoreSearchResults || isSearching) {
      return;
    }

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
      const message = t('eventsPage.error', { message: apiError.message });
      setSearchStatus(message);
      showToast(message, { variant: 'error' });
      trackAnalyticsEvent({
        eventName: 'event_track_search_failed',
        target: 'events',
        properties: {
          code: apiError.code,
          action: 'load_more',
        },
      });
    } finally {
      setIsLoadingMoreSearchResults(false);
    }
  };

  const addTrack = async (track: SearchTrackResult) => {
    if (eventState !== 'open') {
      setSearchStatus(t('eventPublicPage.statusEventClosed'));
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
        `/v1/playlists/link/${encodeURIComponent(params.magicLinkToken)}/tracks`,
        {
          method: 'POST',
          body: JSON.stringify(track),
        },
        (payload) => addEventTrackResponseSchema.parse(payload),
      );

      setTracks((previousTracks) => [
        result.track,
        ...previousTracks.filter(
          (existingTrack) => existingTrack.providerTrackId !== result.track.providerTrackId,
        ),
      ]);
      setSearchStatus(t('eventPublicPage.addedToPlaylist', { name: result.track.name }));
      showToast(t('eventPublicPage.addedToast', { name: result.track.name }), {
        variant: 'success',
      });
    } catch (error) {
      const apiError = toApiError(error);
      const message = t('eventsPage.error', { message: apiError.message });
      setSearchStatus(message);
      showToast(message, { variant: 'error' });
      trackAnalyticsEvent({
        eventName: 'event_track_add_failed',
        target: 'events',
        properties: {
          code: apiError.code,
          providerTrackId: track.providerTrackId,
        },
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

  const isEventReady = Boolean(eventName && eventState && eventProvider && eventConnectionStatus);
  const isClosed = eventState === 'closed';
  const addedTrackIds = new Set(tracks.map((track) => track.providerTrackId));

  // When event is closed, force the added tab
  const effectiveTab = isClosed ? 'added' : activeTab;

  const trackRowClass =
    'group flex min-w-0 items-center gap-3 rounded-xl border border-app-border bg-app-bg px-3 py-3 shadow-soft-lift transition duration-150 hover:border-brand-lime/60 hover:bg-app-surface dark:bg-app-elevated dark:hover:bg-app-card';

  return (
    <div className="relative bg-brand-dark dark:bg-brand-white">
      <HomeFooterReveal />

      <div className="relative z-10 min-h-[calc(100svh+4.5rem)] overflow-hidden rounded-b-[2.75rem] bg-app-bg shadow-[0_28px_64px_-20px_rgba(0,0,0,0.55)] dark:shadow-[0_30px_70px_-20px_rgba(0,0,0,0.72)] sm:min-h-[calc(100svh+5.5rem)] sm:rounded-b-[3.5rem] lg:min-h-[calc(100svh+7rem)] lg:rounded-b-[4.5rem]">
        <BlurSpotLayer
          filterId="public-page-blur-filter"
          className="pointer-events-none absolute inset-0 z-0"
          spots={[
            { id: 'a', size: 260, top: 5, left: 10, color: 'rgba(198,255,0,0.18)' },
            { id: 'b', size: 280, top: 10, left: 78, color: 'rgba(255,46,139,0.18)' },
            { id: 'c', size: 220, top: 50, left: 50, color: 'rgba(125,211,252,0.15)' },
            { id: 'd', size: 240, top: 78, left: 12, color: 'rgba(198,255,0,0.15)' },
            { id: 'e', size: 200, top: 72, left: 88, color: 'rgba(255,46,139,0.15)' },
          ]}
        />

        <section className="relative mx-auto w-full max-w-2xl px-4 pb-16 pt-20 sm:px-6 sm:pt-24 lg:px-8">
          {/* ── Skeleton ── */}
          {isLoading && !isEventReady ? (
            <div className="grid gap-8">
              <div className="flex flex-col items-center gap-4 pt-6 text-center">
                <div className="h-20 w-20 sm:mb-5 animate-pulse rounded-full bg-app-border sm:h-36 sm:w-36" />
                <div className="grid gap-2">
                  <div className="mx-auto h-8 w-56 animate-pulse rounded-xl bg-app-border sm:w-80" />
                  <div className="mx-auto h-4 w-40 animate-pulse rounded-lg bg-app-border" />
                </div>
                <div className="h-5 w-16 animate-pulse rounded-full bg-app-border" />
              </div>
              <div className="h-10 w-full animate-pulse rounded-xl bg-app-border" />
              <ul className="grid gap-3">
                {Array.from({ length: 7 }).map((_, i) => (
                  <li
                    key={i}
                    className="flex min-w-0 items-center gap-3 rounded-xl border border-app-border bg-app-bg px-3 py-3 shadow-soft-lift dark:bg-app-elevated"
                  >
                    <div className="h-11 w-11 shrink-0 animate-pulse rounded-md bg-app-border" />
                    <div className="grid min-w-0 flex-1 gap-1.5">
                      <div className="h-3.5 w-3/4 animate-pulse rounded bg-app-border" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-app-border" />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* ── Error ── */}
          {pageError ? (
            <article className="rounded-2xl border border-brand-pink/40 bg-brand-pink/10 p-4 text-sm text-[#b41563] dark:text-[#ff8ac0]">
              {pageError}
            </article>
          ) : null}

          {/* ── Content ── */}
          {isEventReady ? (
            <div className="grid gap-6">
              {/* Hero header */}
              <header className="flex flex-col items-center gap-3 pt-4 text-center">
                {eventCoverImageUrl ? (
                  <img
                    src={eventCoverImageUrl}
                    alt=""
                    className="h-20 w-20 sm:mb-5 rounded-full border-4 border-app-border shadow-lg object-cover sm:h-36 sm:w-36"
                  />
                ) : null}
                <div className="grid gap-1">
                  <h1 className="text-3xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-4xl">
                    {eventName}
                  </h1>
                  {eventDescription ? (
                    <p className="text-sm text-app-text-secondary sm:text-base">
                      {eventDescription}
                    </p>
                  ) : null}
                </div>
                <EventStatusIndicator
                  status={eventState!}
                  connectionStatus={eventConnectionStatus!}
                  mode="pill"
                />
                {isClosed ? (
                  <p className="text-xs font-semibold text-brand-pink">
                    {t('eventPublicPage.statusEventClosedBrowseOnly')}
                  </p>
                ) : null}
              </header>

              {/* Sticky toolbar: tabs + search */}
              <div className="sticky top-4 z-10 grid gap-5 sm:gap-10">
                {/* Tabs — hide search tab when closed */}
                {!isClosed ? (
                  <div className="relative grid grid-cols-2 overflow-hidden rounded-3xl bg-app-bg dark:bg-app-surface">
                    {/* Sliding pill */}
                    <div
                      className="absolute inset-0 w-1/2 bg-brand-lime transition-transform duration-200 ease-in-out"
                      style={{
                        transform: effectiveTab === 'added' ? 'translateX(100%)' : 'translateX(0)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setActiveTab('results')}
                      className={`relative z-10 inline-flex cursor-pointer items-center justify-center rounded-l-3xl py-3 text-xs font-extrabold leading-none transition-colors duration-200 focus-ring-brand ${
                        effectiveTab === 'results'
                          ? 'text-brand-dark'
                          : 'bg-brand-dark/5 text-app-text-secondary hover:bg-brand-lime/15 hover:text-app-text'
                      }`}
                    >
                      {t('eventPublicPage.tabs.search', { count: searchResults.length })}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('added')}
                      className={`relative z-10 inline-flex cursor-pointer items-center justify-center rounded-r-3xl py-3 text-xs font-extrabold leading-none transition-colors duration-200 focus-ring-brand ${
                        effectiveTab === 'added'
                          ? 'text-brand-dark'
                          : 'bg-brand-dark/5 text-app-text-secondary hover:bg-brand-lime/15 hover:text-app-text'
                      }`}
                    >
                      {t('eventPublicPage.tabs.list', { count: tracks.length })}
                    </button>
                  </div>
                ) : null}

                {/* Search input — only on search tab */}
                {effectiveTab === 'results' ? (
                  <form onSubmit={onSearch}>
                    <label className="relative flex items-center text-sm">
                      <input
                        placeholder={t('eventPublicPage.searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        minLength={2}
                        maxLength={120}
                        className="w-full rounded-xl border border-app-border bg-app-bg py-2.5 pl-4 pr-10 text-app-text outline-none transition focus:border-brand-lime dark:bg-app-elevated"
                      />
                      <span className="absolute right-0 flex h-full items-center pr-3">
                        {isSearching ? (
                          <LoaderCircle
                            size={16}
                            className="animate-spin text-app-text-secondary"
                            aria-hidden="true"
                          />
                        ) : searchQuery ? (
                          <button
                            type="button"
                            aria-label={t('eventPublicPage.clear')}
                            onClick={clearSearch}
                            className="text-app-text-secondary transition hover:text-app-text"
                          >
                            <X size={16} aria-hidden="true" />
                          </button>
                        ) : (
                          <button
                            type="submit"
                            aria-label={t('eventPublicPage.search')}
                            disabled={eventState !== 'open'}
                            className="text-app-text-secondary transition hover:text-app-text disabled:opacity-40"
                          >
                            <Search size={16} aria-hidden="true" />
                          </button>
                        )}
                      </span>
                    </label>
                  </form>
                ) : null}
              </div>

              {/* Track panels */}
              <div>
                {effectiveTab === 'results' ? (
                  <div className="grid gap-3">
                    {searchStatus ? (
                      <p className="text-xs font-semibold text-app-text-secondary">
                        {searchStatus}
                      </p>
                    ) : null}
                    {isSearching ? (
                      <ul className="grid gap-3">
                        {Array.from({ length: 7 }).map((_, i) => (
                          <li
                            key={i}
                            className="flex min-w-0 items-center gap-3 rounded-xl border border-app-border bg-app-bg px-3 py-3 shadow-soft-lift dark:bg-app-elevated"
                          >
                            <div className="h-11 w-11 shrink-0 animate-pulse rounded-md bg-app-border" />
                            <div className="grid min-w-0 flex-1 gap-1.5">
                              <div className="h-3.5 w-3/4 animate-pulse rounded bg-app-border" />
                              <div className="h-3 w-1/2 animate-pulse rounded bg-app-border" />
                            </div>
                            <div className="h-8 w-14 shrink-0 animate-pulse rounded-lg bg-app-border" />
                          </li>
                        ))}
                      </ul>
                    ) : searchResults.length > 0 ? (
                      <>
                        <ul className="grid gap-3">
                          {searchResults.map((track) => {
                            const isAlreadyAdded = addedTrackIds.has(track.providerTrackId);
                            return (
                              <li key={track.providerTrackId} className={trackRowClass}>
                                {track.artworkUrl ? (
                                  <img
                                    src={track.artworkUrl}
                                    alt=""
                                    width={44}
                                    height={44}
                                    className="h-11 w-11 shrink-0 rounded-md object-cover"
                                  />
                                ) : (
                                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-app-border text-xs text-app-text-secondary">
                                    {t('eventPublicPage.notAvailable')}
                                  </span>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-bold text-brand-dark dark:text-brand-white">
                                    {track.name}
                                  </p>
                                  <p className="truncate text-xs text-app-text-secondary">
                                    {track.artist} · {track.album}
                                  </p>
                                </div>
                                <CTAButton
                                  aria-label={
                                    addingTrackId === track.providerTrackId
                                      ? t('eventPublicPage.adding')
                                      : isAlreadyAdded
                                        ? t('eventPublicPage.alreadyAdded')
                                        : t('eventPublicPage.add')
                                  }
                                  disabled={
                                    addingTrackId === track.providerTrackId || isAlreadyAdded
                                  }
                                  onClick={() => void addTrack(track)}
                                  type="button"
                                  variant={isAlreadyAdded ? 'ghost' : 'secondary'}
                                  className="shrink-0"
                                >
                                  {addingTrackId === track.providerTrackId ? (
                                    <LoaderCircle
                                      size={14}
                                      className="animate-spin"
                                      aria-hidden="true"
                                    />
                                  ) : isAlreadyAdded ? (
                                    <Check size={14} aria-hidden="true" />
                                  ) : (
                                    <Plus size={14} aria-hidden="true" />
                                  )}
                                </CTAButton>
                              </li>
                            );
                          })}
                        </ul>
                        {hasMoreSearchResults ? (
                          <div className="flex justify-center pt-1">
                            <CTAButton
                              type="button"
                              variant="secondary"
                              disabled={isLoadingMoreSearchResults}
                              onClick={() => void loadMoreSearchResults()}
                            >
                              {isLoadingMoreSearchResults
                                ? t('eventPublicPage.loadingMoreResults')
                                : t('eventPublicPage.loadMoreResults')}
                            </CTAButton>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-3 py-12 text-center">
                        <Search
                          size={32}
                          className="text-app-text-secondary/40"
                          aria-hidden="true"
                        />
                        <p className="text-sm font-semibold text-app-text-secondary">
                          {hasSearched
                            ? t('eventPublicPage.noResults')
                            : t('eventPublicPage.searchHint')}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs sm:text-sm font-semibold text-app-text-secondary">
                        {t('eventPublicPage.currentTracks', { count: tracks.length })}
                      </p>
                      <button
                        type="button"
                        aria-label={t('eventPublicPage.refresh')}
                        disabled={isLoadingTracks}
                        onClick={() => void loadTracks()}
                        className="group flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-app-border bg-app-surface transition hover:border-brand-pink disabled:opacity-50 dark:bg-app-elevated"
                      >
                        <RefreshCcw
                          size={13}
                          aria-hidden="true"
                          className={`transition-colors group-hover:text-brand-pink ${isLoadingTracks ? 'animate-spin' : 'group-hover:animate-[spin_0.4s_linear_reverse_0.5]'}`}
                        />
                      </button>
                    </div>

                    {isLoadingTracks ? (
                      <ul className="grid gap-3">
                        {Array.from({ length: 7 }).map((_, i) => (
                          <li
                            key={i}
                            className="flex min-w-0 items-center gap-3 rounded-xl border border-app-border bg-app-bg px-3 py-3 shadow-soft-lift dark:bg-app-elevated"
                          >
                            <div className="h-11 w-11 shrink-0 animate-pulse rounded-md bg-app-border" />
                            <div className="grid min-w-0 flex-1 gap-1.5">
                              <div className="h-3.5 w-3/4 animate-pulse rounded bg-app-border" />
                              <div className="h-3 w-1/2 animate-pulse rounded bg-app-border" />
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : tracks.length > 0 ? (
                      <>
                        <ul className="grid gap-3">
                          {tracks.slice(0, visibleAddedTracksCount).map((track) => (
                            <li
                              key={`${track.providerTrackId}-${track.addedAt}`}
                              className={trackRowClass}
                            >
                              {track.artworkUrl ? (
                                <img
                                  src={track.artworkUrl}
                                  alt=""
                                  width={44}
                                  height={44}
                                  className="h-11 w-11 shrink-0 rounded-md object-cover"
                                />
                              ) : null}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold text-brand-dark dark:text-brand-white">
                                  {track.name}
                                </p>
                                <p className="truncate text-xs text-app-text-secondary">
                                  {track.artist} · {track.album}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ul>
                        {tracks.length > visibleAddedTracksCount ? (
                          <div className="flex justify-center pt-1">
                            <CTAButton
                              type="button"
                              variant="secondary"
                              onClick={() =>
                                setVisibleAddedTracksCount((c) => c + ADDED_TRACKS_PAGE_SIZE)
                              }
                            >
                              {t('eventPublicPage.loadMoreTracks')}
                            </CTAButton>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-3 py-12 text-center">
                        <ListMusic
                          size={32}
                          className="text-app-text-secondary/40"
                          aria-hidden="true"
                        />
                        <p className="text-sm font-semibold text-app-text-secondary">
                          {t('eventPublicPage.noTracksYet')}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-center pt-2">
                <div className="flex items-center gap-2 rounded-full border border-app-border/70 bg-app-elevated/90 px-2 py-1.5 shadow-soft-lift backdrop-blur-md dark:bg-app-card/90">
                  <LanguageSwitcher />
                  <ThemeToggle />
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <div aria-hidden className="h-[28rem] sm:h-[24rem] lg:h-[26rem]" />
    </div>
  );
};
