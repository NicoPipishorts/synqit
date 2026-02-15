import {
  addEventTrackResponseSchema,
  eventPublicResponseSchema,
  eventTrackSearchResponseSchema,
  eventTracksResponseSchema,
} from '@synqit/shared';
import { useParams } from '@tanstack/react-router';
import { FormEvent, useCallback, useEffect, useState } from 'react';

import { HostEventDetailsHeader } from '../components/events/HostEventDetailsHeader';
import { CTAButton } from '../components/ui/cta';
import { useToast } from '../hooks/useToast';
import { callApi, toApiError } from '../lib/api';
import { EventProvider, EventStatus, EventTrackItem } from '../lib/events';

type SearchTrackResult = {
  providerTrackId: string;
  name: string;
  artist: string;
  album: string;
  durationMs: number;
  artworkUrl: string | null;
};

export const EventPublicPage = () => {
  const params = useParams({ from: '/event/$magicLinkToken' });
  const { showToast } = useToast();

  const [pageError, setPageError] = useState<string | null>(null);
  const [eventName, setEventName] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventState, setEventState] = useState<EventStatus | null>(null);
  const [eventProvider, setEventProvider] = useState<EventProvider | null>(null);
  const [tracks, setTracks] = useState<EventTrackItem[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchStatus, setSearchStatus] = useState(
    'Search tracks and add them to this event playlist.',
  );
  const [searchResults, setSearchResults] = useState<SearchTrackResult[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [addingTrackId, setAddingTrackId] = useState<string | null>(null);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);

  const loadTracks = useCallback(async () => {
    setIsLoadingTracks(true);
    try {
      const result = await callApi(
        `/v1/events/link/${encodeURIComponent(params.magicLinkToken)}/tracks`,
        {
          method: 'GET',
        },
        (payload) => eventTracksResponseSchema.parse(payload),
      );
      setTracks(result.tracks);
    } catch (error) {
      const apiError = toApiError(error);
      const message = `Error: ${apiError.message}`;
      setPageError(message);
      showToast(message, { variant: 'error' });
    } finally {
      setIsLoadingTracks(false);
    }
  }, [params.magicLinkToken, showToast]);

  useEffect(() => {
    const loadEventAndTracks = async () => {
      setIsLoading(true);
      setPageError(null);
      try {
        const [eventResult, tracksResult] = await Promise.all([
          callApi(
            `/v1/events/link/${encodeURIComponent(params.magicLinkToken)}`,
            {
              method: 'GET',
            },
            (payload) => eventPublicResponseSchema.parse(payload),
          ),
          callApi(
            `/v1/events/link/${encodeURIComponent(params.magicLinkToken)}/tracks`,
            {
              method: 'GET',
            },
            (payload) => eventTracksResponseSchema.parse(payload),
          ),
        ]);

        setEventName(eventResult.event.name);
        setEventDescription(eventResult.event.description);
        setEventState(eventResult.event.status);
        setEventProvider(eventResult.event.provider);
        setTracks(tracksResult.tracks);
      } catch (error) {
        const apiError = toApiError(error);
        const message = `Error: ${apiError.message}`;
        setPageError(message);
        showToast(message, { variant: 'error' });
      } finally {
        setIsLoading(false);
      }
    };

    void loadEventAndTracks();
  }, [params.magicLinkToken, showToast]);

  const onSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (eventState !== 'open') {
      setSearchStatus('This event is closed. New tracks cannot be added.');
      return;
    }

    const nextQuery = searchQuery.trim();
    if (nextQuery.length < 2) {
      setSearchStatus('Type at least 2 characters.');
      return;
    }

    setIsSearching(true);
    try {
      const query = new URLSearchParams({ q: nextQuery });
      const result = await callApi(
        `/v1/events/link/${encodeURIComponent(params.magicLinkToken)}/search?${query.toString()}`,
        {
          method: 'GET',
        },
        (payload) => eventTrackSearchResponseSchema.parse(payload),
      );
      setSearchResults(result.results);
      setSearchStatus(`Found ${result.results.length} track(s).`);
    } catch (error) {
      const apiError = toApiError(error);
      const message = `Error: ${apiError.message}`;
      setSearchStatus(message);
      showToast(message, { variant: 'error' });
    } finally {
      setIsSearching(false);
    }
  };

  const addTrack = async (track: SearchTrackResult) => {
    if (eventState !== 'open') {
      setSearchStatus('This event is closed. New tracks cannot be added.');
      return;
    }

    setAddingTrackId(track.providerTrackId);
    try {
      const result = await callApi(
        `/v1/events/link/${encodeURIComponent(params.magicLinkToken)}/tracks`,
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
      setSearchStatus(`Added "${result.track.name}" to the event playlist.`);
      showToast(`Added "${result.track.name}".`, { variant: 'success' });
    } catch (error) {
      const apiError = toApiError(error);
      const message = `Error: ${apiError.message}`;
      setSearchStatus(message);
      showToast(message, { variant: 'error' });
    } finally {
      setAddingTrackId(null);
    }
  };

  const headerEvent =
    eventName && eventState && eventProvider
      ? {
          name: eventName,
          status: eventState,
          provider: eventProvider,
          description: eventDescription || 'No description provided.',
        }
      : null;

  return (
    <section className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:px-8">
      <div className="relative grid gap-6">
        {isLoading && !eventName ? (
          <article className="rounded-2xl border border-app-border bg-app-elevated p-6 text-sm text-app-text-secondary shadow-soft-lift dark:bg-app-card">
            Loading event...
          </article>
        ) : null}

        {pageError ? (
          <article className="rounded-2xl border border-brand-pink/40 bg-brand-pink/10 p-4 text-sm text-[#b41563] dark:text-[#ff8ac0]">
            {pageError}
          </article>
        ) : null}

        {eventName ? (
          <>
            <HostEventDetailsHeader
              event={headerEvent}
              showBackButton={false}
              showCloseAction={false}
              statusMessage={
                eventState === 'closed'
                  ? 'This event is closed. You can browse tracks, but cannot add new ones.'
                  : undefined
              }
            />

            <article className="rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card">
              <form onSubmit={onSearch} className="grid gap-3">
                <label className="grid gap-1 text-sm">
                  <span>Search tracks</span>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      placeholder="Search songs or artists"
                      value={searchQuery}
                      onChange={(nextEvent) => setSearchQuery(nextEvent.target.value)}
                      minLength={2}
                      maxLength={120}
                      className="w-full rounded-xl border border-app-border bg-app-bg px-3 py-2 text-app-text outline-none transition focus:border-brand-lime dark:bg-app-elevated"
                    />
                    <CTAButton
                      disabled={isSearching || isLoading || eventState !== 'open'}
                      type="submit"
                      variant="primary"
                      className="sm:min-w-28"
                    >
                      {isSearching ? 'Searching...' : 'Search'}
                    </CTAButton>
                  </div>
                </label>
                <p className="text-sm text-app-text-secondary">{searchStatus}</p>
              </form>

              {searchResults.length > 0 ? (
                <ul className="mt-3 grid gap-2">
                  {searchResults.map((track) => (
                    <li
                      key={track.providerTrackId}
                      className="flex min-w-0 items-center gap-3 rounded-xl border border-app-border bg-app-bg px-3 py-2 dark:bg-app-elevated"
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
                          N/A
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
                        disabled={addingTrackId === track.providerTrackId || eventState !== 'open'}
                        onClick={() => void addTrack(track)}
                        type="button"
                        variant="secondary"
                        className="shrink-0"
                      >
                        {addingTrackId === track.providerTrackId ? 'Adding...' : 'Add'}
                      </CTAButton>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>

            <article className="rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-bold text-brand-dark dark:text-brand-white">
                  Current tracks ({tracks.length})
                </h2>
                <CTAButton
                  disabled={isLoadingTracks}
                  onClick={() => void loadTracks()}
                  variant="secondary"
                >
                  {isLoadingTracks ? 'Refreshing...' : 'Refresh'}
                </CTAButton>
              </div>

              {tracks.length > 0 ? (
                <ul className="grid gap-2">
                  {tracks.map((track) => (
                    <li
                      key={`${track.providerTrackId}-${track.addedAt}`}
                      className="flex min-w-0 items-center gap-3 rounded-xl border border-app-border bg-app-bg px-3 py-2 text-sm dark:bg-app-elevated"
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
              ) : (
                <p className="text-sm text-app-text-secondary">No tracks yet.</p>
              )}
            </article>
          </>
        ) : null}
      </div>
    </section>
  );
};
