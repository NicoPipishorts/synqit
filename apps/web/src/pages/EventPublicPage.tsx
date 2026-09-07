import { Highlight } from '@synqit/ui';
import { useParams } from '@tanstack/react-router';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { useEffect } from 'react';

import { EventStatusIndicator } from '../components/events/EventStatusIndicator';
import { PublicSearchPanel } from '../components/events/PublicSearchPanel';
import { TrackSkeletonList } from '../components/events/PublicTrackRow';
import { PublicTracksPanel } from '../components/events/PublicTracksPanel';
import { PublicPageShell } from '../components/public/PublicPageShell';
import { LanguageSwitcher } from '../components/ui/LanguageSwitcher';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { useAuthSession } from '../hooks/useAuthSession';
import { useI18n } from '../hooks/useI18n';
import { ADDED_TRACKS_PAGE_SIZE, usePublicEvent } from '../hooks/usePublicEvent';

export const EventPublicPage = () => {
  const params = useParams({ from: '/playlist/$magicLinkToken' });
  const { t } = useI18n();
  const { auth } = useAuthSession();

  const {
    event,
    pageError,
    tracks,
    isLoading,
    activeTab,
    setActiveTab,
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
    visibleAddedTracksCount,
    setVisibleAddedTracksCount,
    isLoadingTracks,
    loadTracks,
    isTrackMutationPending,
    toggleTracked,
  } = usePublicEvent(params.magicLinkToken);

  // Prevent indexing of this page
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const attrs = {
      content: 'noindex, nofollow, noarchive, nosnippet',
      'data-synqit-route': 'event-public',
    };
    const robotsMeta = Object.assign(document.createElement('meta'), { name: 'robots', ...attrs });
    const googlebotMeta = Object.assign(document.createElement('meta'), {
      name: 'googlebot',
      ...attrs,
    });
    document.head.append(robotsMeta, googlebotMeta);
    return () => {
      robotsMeta.remove();
      googlebotMeta.remove();
    };
  }, []);

  const isClosed = event?.status === 'closed';
  const isProviderPlaylistMissing = event?.closeReason === 'provider_playlist_missing';
  const isEventReady = Boolean(event);
  const effectiveTab = isClosed ? 'added' : activeTab;
  const addedTrackIds = new Set(tracks.map((t) => t.providerTrackId));

  return (
    <PublicPageShell>
      <section className="relative mx-auto w-full max-w-2xl px-4 pb-16 pt-20 sm:px-6 sm:pt-24 lg:px-8">
        {/* Skeleton */}
        {isLoading && !isEventReady ? (
          <div className="grid gap-8">
            <div className="flex flex-col items-center gap-4 pt-6 text-center">
              <div className="h-20 w-20 animate-pulse rounded-full bg-app-border sm:mb-5 sm:h-36 sm:w-36" />
              <div className="grid gap-2">
                <div className="mx-auto h-8 w-56 animate-pulse rounded-xl bg-app-border sm:w-80" />
                <div className="mx-auto h-4 w-40 animate-pulse rounded-lg bg-app-border" />
              </div>
              <div className="h-5 w-16 animate-pulse rounded-full bg-app-border" />
            </div>
            <div className="h-10 w-full animate-pulse rounded-xl bg-app-border" />
            <TrackSkeletonList />
          </div>
        ) : null}

        {/* Error */}
        {pageError ? (
          <article className="rounded-2xl border-2 border-app-text bg-brand-pink/15 p-4 text-sm font-semibold text-app-text shadow-sticker-sm">
            {pageError}
          </article>
        ) : null}

        {/* Content */}
        {isEventReady && event ? (
          <div className="grid gap-3">
            {/* Hero */}
            <header className="flex flex-col items-center gap-3 pt-4 pb-6 text-center relative ">
              {auth && !event.isOwner ? (
                <div className="absolute top-6 right-3 sm:-top-2 sm:right-1 z-10">
                  <button
                    type="button"
                    aria-label={
                      isTrackMutationPending
                        ? t('eventPublicPage.trackingPending')
                        : event.isTracked
                          ? t('eventPublicPage.trackedCta')
                          : t('eventPublicPage.trackCta')
                    }
                    aria-pressed={event.isTracked}
                    disabled={isTrackMutationPending}
                    onClick={() => void toggleTracked()}
                    className={`inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-2 border-app-text shadow-sticker-sm transition sm:static sm:mx-auto sm:mt-2 ${
                      event.isTracked
                        ? 'bg-brand-lime text-brand-dark'
                        : 'bg-app-elevated text-app-text hover:bg-brand-lime hover:text-brand-dark dark:bg-app-card'
                    } disabled:opacity-60`}
                  >
                    {event.isTracked ? (
                      <BookmarkCheck size={26} strokeWidth={2.3} aria-hidden="true" />
                    ) : (
                      <Bookmark size={26} strokeWidth={2.3} aria-hidden="true" />
                    )}
                  </button>
                </div>
              ) : null}
              {event.coverImageUrl ? (
                <img
                  src={event.coverImageUrl}
                  alt=""
                  className="h-20 w-20 rounded-full border-[3px] border-app-text object-cover shadow-sticker sm:mb-5 sm:h-36 sm:w-36"
                />
              ) : null}
              <div className="grid relative gap-1 pt-[5%] sm:pt-0">
                <h1 className="px-8 text-3xl font-black leading-[1.05] tracking-tight text-balance text-brand-dark dark:text-brand-white sm:px-0 sm:text-5xl">
                  <Highlight>{event.name}</Highlight>
                </h1>
                {event.description ? (
                  <p className="text-sm text-app-text-secondary sm:text-base">
                    {event.description}
                  </p>
                ) : null}
              </div>
              <EventStatusIndicator
                status={event.status}
                closeReason={event.closeReason}
                connectionStatus={event.connectionStatus}
                mode="pill"
              />
            </header>

            {/* Tab bar — hidden when closed */}
            {!isClosed ? (
              <div className="sticky top-4 z-10">
                <div className="relative grid grid-cols-2 rounded-full border-2 border-app-text bg-app-elevated p-1 shadow-sticker dark:bg-app-card">
                  <div
                    aria-hidden="true"
                    className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full border-2 border-app-text bg-brand-lime transition-transform duration-200 ease-in-out"
                    style={{
                      transform: effectiveTab === 'added' ? 'translateX(100%)' : 'translateX(0)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setActiveTab('results')}
                    className={`relative z-10 inline-flex cursor-pointer items-center justify-center rounded-full py-2.5 text-xs font-black uppercase tracking-[0.08em] leading-none transition-colors duration-200 focus-ring-brand ${
                      effectiveTab === 'results'
                        ? 'text-brand-dark'
                        : 'text-app-text-secondary hover:text-app-text'
                    }`}
                  >
                    {t('eventPublicPage.tabs.search', { count: searchResults.length })}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('added')}
                    className={`relative z-10 inline-flex cursor-pointer items-center justify-center rounded-full py-2.5 text-xs font-black uppercase tracking-[0.08em] leading-none transition-colors duration-200 focus-ring-brand ${
                      effectiveTab === 'added'
                        ? 'text-brand-dark'
                        : 'text-app-text-secondary hover:text-app-text'
                    }`}
                  >
                    {t('eventPublicPage.tabs.list', { count: tracks.length })}
                  </button>
                </div>
              </div>
            ) : null}

            {/* Panels */}
            {effectiveTab === 'results' ? (
              <PublicSearchPanel
                searchQuery={searchQuery}
                searchStatus={searchStatus}
                searchResults={searchResults}
                hasSearched={hasSearched}
                hasMoreSearchResults={hasMoreSearchResults}
                isSearching={isSearching}
                isLoadingMoreSearchResults={isLoadingMoreSearchResults}
                addingTrackId={addingTrackId}
                addedTrackIds={addedTrackIds}
                isEventOpen={event.status === 'open'}
                onSearch={onSearch}
                onQueryChange={setSearchQuery}
                onClearSearch={clearSearch}
                onAddTrack={(track) => void addTrack(track)}
                onLoadMore={() => void loadMoreSearchResults()}
              />
            ) : (
              <PublicTracksPanel
                tracks={tracks}
                visibleCount={visibleAddedTracksCount}
                isLoading={isLoadingTracks}
                isProviderPlaylistMissing={isProviderPlaylistMissing}
                onRefresh={() => void loadTracks()}
                onLoadMore={() => setVisibleAddedTracksCount((c) => c + ADDED_TRACKS_PAGE_SIZE)}
              />
            )}

            {/* Footer controls */}
            <div className="flex justify-center pt-2">
              <div className="flex items-center gap-2 rounded-full border-2 border-app-text bg-app-elevated px-2 py-1.5 shadow-sticker-sm dark:bg-app-card">
                <LanguageSwitcher />
                <ThemeToggle />
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </PublicPageShell>
  );
};
