import {
  addEventTrackResponseSchema,
  eventPublicResponseSchema,
  eventTrackSearchResponseSchema,
  eventTracksResponseSchema,
} from '@synqit/shared';
import { useParams } from '@tanstack/react-router';
import { FormEvent, useCallback, useEffect, useState } from 'react';

import { callApi, toApiError } from '../lib/api';

export const EventPublicPage = () => {
  const params = useParams({ from: '/event/$magicLinkToken' });
  const [status, setStatus] = useState('Loading event...');
  const [eventName, setEventName] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventState, setEventState] = useState('');
  const [tracks, setTracks] = useState<
    Array<{
      providerTrackId: string;
      name: string;
      artist: string;
      album: string;
      durationMs: number;
      artworkUrl: string | null;
      addedAt: string;
      addedBy: string;
    }>
  >([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchStatus, setSearchStatus] = useState('Search tracks and add to this event playlist.');
  const [searchResults, setSearchResults] = useState<
    Array<{
      providerTrackId: string;
      name: string;
      artist: string;
      album: string;
      durationMs: number;
      artworkUrl: string | null;
    }>
  >([]);
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
      setStatus(`Error: ${apiError.message}`);
    } finally {
      setIsLoadingTracks(false);
    }
  }, [params.magicLinkToken]);

  useEffect(() => {
    const loadEventAndTracks = async () => {
      setIsLoading(true);
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
        setTracks(tracksResult.tracks);
        setStatus('Event loaded.');
      } catch (error) {
        const apiError = toApiError(error);
        setStatus(`Error: ${apiError.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    void loadEventAndTracks();
  }, [params.magicLinkToken]);

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
      setSearchStatus(`Error: ${apiError.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const addTrack = async (track: {
    providerTrackId: string;
    name: string;
    artist: string;
    album: string;
    durationMs: number;
    artworkUrl: string | null;
  }) => {
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
    } catch (error) {
      const apiError = toApiError(error);
      setSearchStatus(`Error: ${apiError.message}`);
    } finally {
      setAddingTrackId(null);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '0.75rem', maxWidth: '42rem' }}>
      <h2>Event Playlist</h2>
      <p>{status}</p>
      {eventName ? (
        <>
          <p>
            <strong>{eventName}</strong>
          </p>
          <p>{eventDescription || 'No description provided.'}</p>
          <p>Status: {eventState}</p>
          <form onSubmit={onSearch} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              placeholder="Search songs or artists"
              value={searchQuery}
              onChange={(nextEvent) => setSearchQuery(nextEvent.target.value)}
              minLength={2}
              maxLength={120}
              style={{ flex: 1, minWidth: '16rem' }}
            />
            <button disabled={isSearching || isLoading || eventState !== 'open'} type="submit">
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </form>
          <p>{searchStatus}</p>
          {searchResults.length > 0 ? (
            <ul>
              {searchResults.map((track) => (
                <li key={track.providerTrackId} style={{ marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {track.artworkUrl ? (
                      <img
                        src={track.artworkUrl}
                        alt=""
                        width={48}
                        height={48}
                        style={{ borderRadius: '0.25rem' }}
                      />
                    ) : null}
                    <div style={{ flex: 1 }}>
                      <strong>{track.name}</strong> - {track.artist}
                      <br />
                      <small>
                        {track.album} • {Math.round(track.durationMs / 1000)}s
                      </small>
                    </div>
                    <button
                      disabled={addingTrackId === track.providerTrackId || eventState !== 'open'}
                      onClick={() => void addTrack(track)}
                      type="button"
                    >
                      {addingTrackId === track.providerTrackId ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h3 style={{ margin: 0 }}>Current Tracks ({tracks.length})</h3>
            <button disabled={isLoadingTracks} onClick={() => void loadTracks()} type="button">
              {isLoadingTracks ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          {tracks.length > 0 ? (
            <ul>
              {tracks.map((track) => (
                <li key={`${track.providerTrackId}-${track.addedAt}`}>
                  {track.name} - {track.artist} ({track.album})
                </li>
              ))}
            </ul>
          ) : (
            <p>No tracks yet.</p>
          )}
        </>
      ) : null}
    </div>
  );
};
