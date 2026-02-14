import {
  deleteEventResponseSchema,
  eventListResponseSchema,
  eventResponseSchema,
  eventTracksResponseSchema,
  removeEventTrackResponseSchema,
  updateEventRequestSchema,
} from '@synqit/shared';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import { callApi, toApiError } from '../lib/api';
import { getAccessToken } from '../lib/auth';

export const HostEventsPage = () => {
  const [status, setStatus] = useState('Load your events.');
  const [events, setEvents] = useState<
    Array<{
      id: string;
      name: string;
      description: string;
      status: 'open' | 'closed';
      magicLinkToken: string;
      magicLinkRevokedAt: string | null;
      updatedAt: string;
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [actionEventId, setActionEventId] = useState<string | null>(null);
  const [expandedTracksEventId, setExpandedTracksEventId] = useState<string | null>(null);
  const [tracksByEventId, setTracksByEventId] = useState<
    Record<
      string,
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
    >
  >({});
  const [loadingTracksEventId, setLoadingTracksEventId] = useState<string | null>(null);
  const [trackActionKey, setTrackActionKey] = useState<string | null>(null);

  const loadEvents = async () => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus('Login required to view events.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await callApi(
        '/v1/events',
        {
          method: 'GET',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
        (payload) => eventListResponseSchema.parse(payload),
      );

      setEvents(
        result.events.map((event) => ({
          id: event.id,
          name: event.name,
          description: event.description,
          status: event.status,
          magicLinkToken: event.magicLinkToken,
          magicLinkRevokedAt: event.magicLinkRevokedAt,
          updatedAt: event.updatedAt,
        })),
      );
      setStatus(`Loaded ${result.events.length} events.`);
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const startEdit = (event: { id: string; name: string; description: string }) => {
    setEditingEventId(event.id);
    setEditName(event.name);
    setEditDescription(event.description);
  };

  const cancelEdit = () => {
    setEditingEventId(null);
    setEditName('');
    setEditDescription('');
  };

  const saveEvent = async (eventId: string) => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus('Login required to update events.');
      return;
    }

    setActionEventId(eventId);
    try {
      const payload = updateEventRequestSchema.parse({
        name: editName,
        description: editDescription,
      });

      const result = await callApi(
        `/v1/events/${encodeURIComponent(eventId)}`,
        {
          method: 'PATCH',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        },
        (responsePayload) => eventResponseSchema.parse(responsePayload),
      );

      setEvents((previousEvents) =>
        previousEvents.map((event) =>
          event.id === eventId
            ? {
                ...event,
                name: result.event.name,
                description: result.event.description,
                status: result.event.status,
                updatedAt: result.event.updatedAt,
              }
            : event,
        ),
      );
      setStatus(`Updated "${result.event.name}".`);
      cancelEdit();
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message}`);
    } finally {
      setActionEventId(null);
    }
  };

  const closeEvent = async (eventId: string) => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus('Login required to close events.');
      return;
    }

    setActionEventId(eventId);
    try {
      const result = await callApi(
        `/v1/events/${encodeURIComponent(eventId)}/close`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
        (responsePayload) => eventResponseSchema.parse(responsePayload),
      );

      setEvents((previousEvents) =>
        previousEvents.map((event) =>
          event.id === eventId
            ? {
                ...event,
                status: result.event.status,
                updatedAt: result.event.updatedAt,
              }
            : event,
        ),
      );
      setStatus(`Closed "${result.event.name}".`);
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message}`);
    } finally {
      setActionEventId(null);
    }
  };

  const revokeMagicLink = async (eventId: string) => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus('Login required to revoke links.');
      return;
    }

    setActionEventId(eventId);
    try {
      const result = await callApi(
        `/v1/events/${encodeURIComponent(eventId)}/magic-link/revoke`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
        (responsePayload) => eventResponseSchema.parse(responsePayload),
      );

      setEvents((previousEvents) =>
        previousEvents.map((event) =>
          event.id === eventId
            ? {
                ...event,
                magicLinkToken: result.event.magicLinkToken,
                magicLinkRevokedAt: result.event.magicLinkRevokedAt,
                updatedAt: result.event.updatedAt,
              }
            : event,
        ),
      );
      setStatus(`Revoked magic link for "${result.event.name}".`);
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message}`);
    } finally {
      setActionEventId(null);
    }
  };

  const regenerateMagicLink = async (eventId: string) => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus('Login required to regenerate links.');
      return;
    }

    setActionEventId(eventId);
    try {
      const result = await callApi(
        `/v1/events/${encodeURIComponent(eventId)}/magic-link/regenerate`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
        (responsePayload) => eventResponseSchema.parse(responsePayload),
      );

      setEvents((previousEvents) =>
        previousEvents.map((event) =>
          event.id === eventId
            ? {
                ...event,
                magicLinkToken: result.event.magicLinkToken,
                magicLinkRevokedAt: result.event.magicLinkRevokedAt,
                updatedAt: result.event.updatedAt,
              }
            : event,
        ),
      );
      setStatus(`Generated new magic link for "${result.event.name}".`);
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message}`);
    } finally {
      setActionEventId(null);
    }
  };

  const loadTracksForEvent = async (eventId: string) => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus('Login required to view event tracks.');
      return;
    }

    setLoadingTracksEventId(eventId);
    try {
      const result = await callApi(
        `/v1/events/${encodeURIComponent(eventId)}/tracks`,
        {
          method: 'GET',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
        (responsePayload) => eventTracksResponseSchema.parse(responsePayload),
      );

      setTracksByEventId((previousTracks) => ({
        ...previousTracks,
        [eventId]: result.tracks,
      }));
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message}`);
    } finally {
      setLoadingTracksEventId(null);
    }
  };

  const toggleTracks = async (eventId: string) => {
    if (expandedTracksEventId === eventId) {
      setExpandedTracksEventId(null);
      return;
    }

    setExpandedTracksEventId(eventId);
    if (!tracksByEventId[eventId]) {
      await loadTracksForEvent(eventId);
    }
  };

  const removeTrack = async (eventId: string, providerTrackId: string) => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus('Login required to remove tracks.');
      return;
    }

    const actionKey = `${eventId}:${providerTrackId}`;
    setTrackActionKey(actionKey);
    try {
      await callApi(
        `/v1/events/${encodeURIComponent(eventId)}/tracks/${encodeURIComponent(providerTrackId)}`,
        {
          method: 'DELETE',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
        (responsePayload) => removeEventTrackResponseSchema.parse(responsePayload),
      );

      setTracksByEventId((previousTracks) => ({
        ...previousTracks,
        [eventId]: (previousTracks[eventId] ?? []).filter(
          (track) => track.providerTrackId !== providerTrackId,
        ),
      }));
      setStatus('Track removed.');
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message}`);
    } finally {
      setTrackActionKey(null);
    }
  };

  const deleteEvent = async (eventId: string) => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus('Login required to delete events.');
      return;
    }

    if (!window.confirm('Delete this event? This only removes it from Synqit for now.')) {
      return;
    }

    setActionEventId(eventId);
    try {
      const result = await callApi(
        `/v1/events/${encodeURIComponent(eventId)}`,
        {
          method: 'DELETE',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
        (responsePayload) => deleteEventResponseSchema.parse(responsePayload),
      );

      setEvents((previousEvents) => previousEvents.filter((event) => event.id !== result.eventId));
      setStatus('Event deleted.');
      if (editingEventId === result.eventId) {
        cancelEdit();
      }
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message}`);
    } finally {
      setActionEventId(null);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <h2>My Events</h2>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button disabled={isLoading} onClick={() => void loadEvents()} type="button">
          {isLoading ? 'Loading...' : 'Load events'}
        </button>
        <Link to="/events/new">Create new event</Link>
      </div>
      <p>{status}</p>
      {events.length > 0 ? (
        <ul>
          {events.map((event) => (
            <li key={event.id} style={{ marginBottom: '0.75rem' }}>
              {editingEventId === event.id ? (
                <form
                  onSubmit={(submitEvent) => {
                    submitEvent.preventDefault();
                    void saveEvent(event.id);
                  }}
                  style={{ display: 'grid', gap: '0.5rem', maxWidth: '38rem' }}
                >
                  <label>
                    Event name
                    <input
                      required
                      maxLength={100}
                      value={editName}
                      onChange={(nextEvent) => setEditName(nextEvent.target.value)}
                      style={{ width: '100%' }}
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      maxLength={500}
                      value={editDescription}
                      onChange={(nextEvent) => setEditDescription(nextEvent.target.value)}
                      style={{ width: '100%', minHeight: '4rem' }}
                    />
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button disabled={actionEventId === event.id} type="submit">
                      {actionEventId === event.id ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      disabled={actionEventId === event.id}
                      onClick={() => cancelEdit()}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div style={{ display: 'grid', gap: '0.25rem' }}>
                  <strong>{event.name}</strong>
                  <span>{event.description || 'No description provided.'}</span>
                  <span>Status: {event.status}</span>
                  <span>
                    Guest link:{' '}
                    {event.magicLinkRevokedAt ? (
                      'Revoked'
                    ) : (
                      <a href={`${window.location.origin}/event/${event.magicLinkToken}`}>
                        {`${window.location.origin}/event/${event.magicLinkToken}`}
                      </a>
                    )}
                  </span>
                  <span>Last updated: {new Date(event.updatedAt).toLocaleString()}</span>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      disabled={actionEventId === event.id}
                      onClick={() => startEdit(event)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      disabled={actionEventId === event.id || event.status !== 'open'}
                      onClick={() => void closeEvent(event.id)}
                      type="button"
                    >
                      {actionEventId === event.id ? 'Working...' : 'Close'}
                    </button>
                    <button
                      disabled={actionEventId === event.id}
                      onClick={() => void deleteEvent(event.id)}
                      type="button"
                    >
                      {actionEventId === event.id ? 'Working...' : 'Delete'}
                    </button>
                    <button
                      disabled={actionEventId === event.id || Boolean(event.magicLinkRevokedAt)}
                      onClick={() => void revokeMagicLink(event.id)}
                      type="button"
                    >
                      {actionEventId === event.id ? 'Working...' : 'Revoke Link'}
                    </button>
                    <button
                      disabled={actionEventId === event.id}
                      onClick={() => void regenerateMagicLink(event.id)}
                      type="button"
                    >
                      {actionEventId === event.id ? 'Working...' : 'Regenerate Link'}
                    </button>
                    <button
                      disabled={loadingTracksEventId === event.id}
                      onClick={() => void toggleTracks(event.id)}
                      type="button"
                    >
                      {expandedTracksEventId === event.id ? 'Hide Tracks' : 'Manage Tracks'}
                    </button>
                  </div>
                  {expandedTracksEventId === event.id ? (
                    <div style={{ marginTop: '0.5rem' }}>
                      <p style={{ margin: 0 }}>Tracks ({tracksByEventId[event.id]?.length ?? 0})</p>
                      {loadingTracksEventId === event.id ? <p>Loading tracks...</p> : null}
                      {(tracksByEventId[event.id] ?? []).length > 0 ? (
                        <ul>
                          {(tracksByEventId[event.id] ?? []).map((track) => {
                            const nextActionKey = `${event.id}:${track.providerTrackId}`;
                            return (
                              <li key={track.providerTrackId} style={{ marginBottom: '0.25rem' }}>
                                {track.name} - {track.artist}
                                {' · '}
                                <button
                                  disabled={trackActionKey === nextActionKey}
                                  onClick={() => void removeTrack(event.id, track.providerTrackId)}
                                  type="button"
                                >
                                  {trackActionKey === nextActionKey ? 'Removing...' : 'Remove'}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      ) : loadingTracksEventId !== event.id ? (
                        <p>No tracks in this event yet.</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
