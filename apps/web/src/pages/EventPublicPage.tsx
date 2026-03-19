import {
  addEventTrackResponseSchema,
  eventPublicResponseSchema,
  eventTrackSearchResponseSchema,
  eventTracksResponseSchema,
} from '@synqit/shared';
import { useParams } from '@tanstack/react-router';
import { Check, LoaderCircle, Plus, RefreshCcw, Search, X } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';

import { HostEventDetailsHeader } from '../components/events/HostEventDetailsHeader';
import { HomeFooterReveal } from '../components/marketing/HomeFooterReveal';
import { BlurSpotLayer } from '../components/shell/BackgroundBlurSpots';
import { CTAButton, CTAMobileIconLabel } from '../components/ui/cta';
import { LanguageSwitcher } from '../components/ui/LanguageSwitcher';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { useI18n } from '../hooks/useI18n';
import { useToast } from '../hooks/useToast';
import { trackAnalyticsEvent } from '../lib/analytics';
import { callApi, toApiError } from '../lib/api';
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

  const headerEvent =
    eventName && eventState && eventProvider && eventConnectionStatus
      ? {
          name: eventName,
          status: eventState,
          providerConnectionStatus: eventConnectionStatus,
          provider: eventProvider,
          description: eventDescription || t('eventPublicPage.noDescription'),
        }
      : null;
  const isSearchPanelVisible = activeTab === 'results';
  const addedTrackIds = new Set(tracks.map((track) => track.providerTrackId));

  return (
    <div className="relative bg-brand-dark dark:bg-brand-white">
      <HomeFooterReveal />

      <div className="relative z-10 min-h-full overflow-hidden rounded-b-[2.75rem] bg-app-bg shadow-[0_28px_64px_-20px_rgba(0,0,0,0.55)] dark:shadow-[0_30px_70px_-20px_rgba(0,0,0,0.72)] sm:rounded-b-[3.5rem] lg:rounded-b-[4.5rem]">
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
        <section className="relative mx-auto min-h-[107vh] w-full max-w-6xl px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:px-8">
          <div className="relative grid gap-6">
            {isLoading && !eventName ? (
              <div className="grid gap-6">
                {/* Header skeleton */}
                <div className="px-5 py-7 sm:px-8 sm:py-9">
                  <div className="flex items-start gap-4">
                    <div className="grid flex-1 gap-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="h-9 w-56 animate-pulse rounded-xl bg-app-border sm:h-12 sm:w-80" />
                        <div className="h-5 w-16 animate-pulse rounded-full bg-app-border" />
                      </div>
                      <div className="h-4 w-48 animate-pulse rounded-lg bg-app-border sm:w-64" />
                    </div>
                    <div className="h-14 w-14 animate-pulse rounded-2xl bg-app-border sm:h-16 sm:w-16 lg:h-[4.5rem] lg:w-[4.5rem]" />
                  </div>
                </div>

                {/* Tab pills skeleton */}
                <div className="flex gap-2 px-5 sm:px-8">
                  <div className="h-7 w-20 animate-pulse rounded-lg bg-app-border" />
                  <div className="h-7 w-20 animate-pulse rounded-lg bg-app-border" />
                </div>

                {/* Tracks card skeleton */}
                <article className="relative overflow-hidden rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card">
                  <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <li
                        key={i}
                        className="flex min-w-0 items-center gap-3 rounded-xl border border-app-border bg-app-bg px-3 py-2 shadow-soft-lift dark:bg-app-elevated"
                      >
                        <div className="h-10 w-10 shrink-0 animate-pulse rounded-md bg-app-border" />
                        <div className="min-w-0 flex-1 grid gap-1.5">
                          <div className="h-3.5 w-3/4 animate-pulse rounded bg-app-border" />
                          <div className="h-3 w-1/2 animate-pulse rounded bg-app-border" />
                        </div>
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {pageError ? (
              <article className="rounded-2xl border border-brand-pink/40 bg-brand-pink/10 p-4 text-sm text-[#b41563] dark:text-[#ff8ac0]">
                {pageError}
              </article>
            ) : null}

            {headerEvent ? (
              <>
                <HostEventDetailsHeader
                  event={headerEvent}
                  showBackButton={false}
                  showCloseAction={false}
                  statusMessage={
                    eventState === 'closed'
                      ? t('eventPublicPage.statusEventClosedBrowseOnly')
                      : undefined
                  }
                />

                <div className="flex flex-wrap gap-2 px-5 sm:px-8">
                  <button
                    type="button"
                    onClick={() => setActiveTab('results')}
                    className={`inline-flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-xs font-extrabold leading-none shadow-soft-lift transition focus-ring-brand ${
                      activeTab === 'results'
                        ? 'border-[#9fce00] bg-brand-lime text-brand-dark'
                        : 'border-app-border bg-app-surface text-app-text hover:border-brand-lime dark:bg-app-elevated'
                    }`}
                  >
                    {t('eventPublicPage.tabs.search', { count: searchResults.length })}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('added')}
                    className={`inline-flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-xs font-extrabold leading-none shadow-soft-lift transition focus-ring-brand ${
                      activeTab === 'added'
                        ? 'border-[#9fce00] bg-brand-lime text-brand-dark'
                        : 'border-app-border bg-app-surface text-app-text hover:border-brand-lime dark:bg-app-elevated'
                    }`}
                  >
                    {t('eventPublicPage.tabs.list', { count: tracks.length })}
                  </button>
                </div>

                <article className="relative overflow-hidden rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card">
                  {activeTab === 'results' ? (
                    <div
                      className={`grid overflow-hidden transition-all duration-300 ease-out ${
                        isSearchPanelVisible
                          ? 'max-h-72 translate-y-0 opacity-100 pb-3'
                          : 'max-h-0 -translate-y-4 opacity-0'
                      }`}
                    >
                      <form onSubmit={onSearch}>
                        <label className="relative flex items-center text-sm">
                          <input
                            placeholder={t('eventPublicPage.searchPlaceholder')}
                            value={searchQuery}
                            onChange={(nextEvent) => setSearchQuery(nextEvent.target.value)}
                            minLength={2}
                            maxLength={120}
                            className="w-full rounded-xl border border-app-border bg-app-bg py-2 pl-4 pr-10 text-app-text outline-none transition focus:border-brand-lime dark:bg-app-elevated"
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
                                disabled={isLoading || eventState !== 'open'}
                                className="text-app-text-secondary transition hover:text-app-text disabled:opacity-40"
                              >
                                <Search size={16} aria-hidden="true" />
                              </button>
                            )}
                          </span>
                        </label>
                      </form>
                      {searchStatus ? (
                        <p className="mt-2 text-sm font-semibold text-app-text-secondary">
                          {searchStatus}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {activeTab === 'results' ? (
                    <div className="mt-3 grid gap-3">
                      {isSearching ? (
                        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                          {Array.from({ length: 7 }).map((_, i) => (
                            <li
                              key={i}
                              className="flex min-w-0 items-center gap-3 rounded-xl border border-app-border bg-app-bg px-3 py-2 shadow-soft-lift dark:bg-app-elevated"
                            >
                              <div className="h-12 w-12 shrink-0 animate-pulse rounded-md bg-app-border" />
                              <div className="min-w-0 flex-1 grid gap-1.5">
                                <div className="h-3.5 w-3/4 animate-pulse rounded bg-app-border" />
                                <div className="h-3 w-1/2 animate-pulse rounded bg-app-border" />
                              </div>
                              <div className="h-8 w-14 shrink-0 animate-pulse rounded-lg bg-app-border" />
                            </li>
                          ))}
                        </ul>
                      ) : searchResults.length > 0 ? (
                        <>
                          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {searchResults.map((track) => {
                              const isAlreadyAdded = addedTrackIds.has(track.providerTrackId);
                              return (
                                <li
                                  key={track.providerTrackId}
                                  className="flex min-w-0 items-center gap-3 rounded-xl border border-app-border bg-app-bg px-3 py-2 shadow-soft-lift dark:bg-app-elevated"
                                >
                                  {track.artworkUrl ? (
                                    <img
                                      src={track.artworkUrl}
                                      alt=""
                                      width={48}
                                      height={48}
                                      className="h-12 w-12 shrink-0 rounded-md object-cover"
                                    />
                                  ) : (
                                    <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-app-border text-xs text-app-text-secondary">
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
                                      addingTrackId === track.providerTrackId ||
                                      eventState !== 'open' ||
                                      isAlreadyAdded
                                    }
                                    onClick={() => void addTrack(track)}
                                    type="button"
                                    variant="secondary"
                                    className="shrink-0"
                                  >
                                    {addingTrackId === track.providerTrackId ? (
                                      <>
                                        <LoaderCircle
                                          size={14}
                                          className="animate-spin sm:hidden"
                                          aria-hidden="true"
                                        />
                                        <span className="hidden sm:inline">
                                          {t('eventPublicPage.adding')}
                                        </span>
                                      </>
                                    ) : isAlreadyAdded ? (
                                      <>
                                        <Check size={14} aria-hidden="true" className="sm:hidden" />
                                        <span className="hidden sm:inline">
                                          {t('eventPublicPage.alreadyAdded')}
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <Plus size={14} aria-hidden="true" className="sm:hidden" />
                                        <span className="hidden sm:inline">
                                          {t('eventPublicPage.add')}
                                        </span>
                                      </>
                                    )}
                                  </CTAButton>
                                </li>
                              );
                            })}
                          </ul>
                          {hasMoreSearchResults ? (
                            <div className="flex justify-center">
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
                        <p className="py-4 text-center text-md font-bold text-app-text-secondary">
                          {hasSearched
                            ? t('eventPublicPage.noResults')
                            : t('eventPublicPage.searchHint')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 grid gap-3">
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-xl font-bold text-brand-dark dark:text-brand-white">
                          {t('eventPublicPage.currentTracks', { count: tracks.length })}
                        </h2>
                        <CTAButton
                          aria-label={t('eventPublicPage.refresh')}
                          disabled={isLoadingTracks}
                          onClick={() => void loadTracks()}
                          variant="secondary"
                          className="h-10 w-10 px-0 sm:h-auto sm:w-auto sm:px-3"
                        >
                          <CTAMobileIconLabel
                            icon={
                              <RefreshCcw
                                size={14}
                                aria-hidden="true"
                                className={isLoadingTracks ? 'animate-spin' : ''}
                              />
                            }
                            label={
                              isLoadingTracks
                                ? t('eventPublicPage.refreshing')
                                : t('eventPublicPage.refresh')
                            }
                          />
                        </CTAButton>
                      </div>

                      {tracks.length > 0 ? (
                        <>
                          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {tracks.slice(0, visibleAddedTracksCount).map((track) => (
                              <li
                                key={`${track.providerTrackId}-${track.addedAt}`}
                                className="flex min-w-0 items-center gap-3 rounded-xl border border-app-border bg-app-bg px-3 py-2 text-sm shadow-soft-lift dark:bg-app-elevated"
                              >
                                {track.artworkUrl ? (
                                  <img
                                    src={track.artworkUrl}
                                    alt=""
                                    width={40}
                                    height={40}
                                    className="h-10 w-10 shrink-0 rounded-md object-cover"
                                  />
                                ) : null}
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-semibold text-brand-dark dark:text-brand-white">
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
                            <div className="flex justify-center">
                              <CTAButton
                                type="button"
                                variant="secondary"
                                onClick={() =>
                                  setVisibleAddedTracksCount(
                                    (currentCount) => currentCount + ADDED_TRACKS_PAGE_SIZE,
                                  )
                                }
                              >
                                {t('eventPublicPage.loadMoreTracks')}
                              </CTAButton>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <p className="text-sm text-app-text-secondary">
                          {t('eventPublicPage.noTracksYet')}BlurSpotLayer
                        </p>
                      )}
                    </div>
                  )}
                </article>

                <div className="mx-auto flex w-full max-w-6xl justify-center">
                  <div className="flex items-center gap-2 rounded-full border border-app-border/70 bg-app-elevated/90 px-2 py-1.5 shadow-soft-lift backdrop-blur-md dark:bg-app-card/90">
                    <LanguageSwitcher />
                    <ThemeToggle />
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </section>
      </div>

      <div aria-hidden className="h-[28rem] sm:h-[24rem] lg:h-[26rem]" />
    </div>
  );
};
