import {
  addEventTrackResponseSchema,
  ApiError,
  authResponseSchema,
  authUserSchema,
  deleteEventResponseSchema,
  eventListResponseSchema,
  eventPublicResponseSchema,
  eventResponseSchema,
  eventTrackSearchResponseSchema,
  eventTracksResponseSchema,
  integrationDisconnectResponseSchema,
  integrationListResponseSchema,
  oauthCallbackResponseSchema,
  oauthStartResponseSchema,
  providerSchema,
  refreshTokenRequestSchema,
  removeEventTrackResponseSchema,
  updateEventRequestSchema,
} from '@synqit/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Link,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  useParams,
} from '@tanstack/react-router';
import { FormEvent, StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

const queryClient = new QueryClient();
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const AUTH_STORAGE_KEY = 'synqit.auth.v1';

type StoredAuth = {
  accessToken: string;
  refreshToken: string;
  userEmail: string;
};

const loadAuth = (): StoredAuth | null => {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredAuth>;
    if (
      typeof parsed.accessToken !== 'string' ||
      typeof parsed.refreshToken !== 'string' ||
      typeof parsed.userEmail !== 'string'
    ) {
      return null;
    }

    return parsed as StoredAuth;
  } catch {
    return null;
  }
};

const storeAuth = (authResponse: unknown): StoredAuth => {
  const parsed = authResponseSchema.parse(authResponse);
  const nextAuth: StoredAuth = {
    accessToken: parsed.tokens.accessToken,
    refreshToken: parsed.tokens.refreshToken,
    userEmail: parsed.user.email,
  };

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth));
  return nextAuth;
};

const clearAuth = (): void => {
  localStorage.removeItem(AUTH_STORAGE_KEY);
};

const toApiError = (value: unknown): ApiError => {
  if (
    value &&
    typeof value === 'object' &&
    'code' in value &&
    typeof value.code === 'string' &&
    'message' in value &&
    typeof value.message === 'string'
  ) {
    return value as ApiError;
  }

  return {
    code: 'unknown_error',
    message: 'Unexpected error.',
  };
};

const callApi = async <TResponse,>(
  path: string,
  init: RequestInit,
  parser: (payload: unknown) => TResponse,
): Promise<TResponse> => {
  const hasBody = init.body !== undefined && init.body !== null;

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(hasBody ? { 'content-type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    throw toApiError(payload);
  }

  return parser(payload);
};

const getAccessToken = (): string | null => loadAuth()?.accessToken ?? null;

const AuthForm = ({
  endpoint,
  title,
}: {
  endpoint: '/v1/auth/register' | '/v1/auth/login';
  title: string;
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus('');

    try {
      const result = await callApi(
        endpoint,
        {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        },
        (payload) => payload,
      );

      const auth = storeAuth(result);
      setStatus(`Success. Logged in as ${auth.userEmail}.`);
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: '0.75rem', maxWidth: '24rem' }}>
      <h2>{title}</h2>
      <label>
        Email
        <input
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          style={{ width: '100%' }}
        />
      </label>
      <label>
        Password
        <input
          required
          minLength={8}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          style={{ width: '100%' }}
        />
      </label>
      <button disabled={isSubmitting} type="submit">
        {isSubmitting ? 'Submitting...' : title}
      </button>
      {status ? <p>{status}</p> : null}
    </form>
  );
};

const DashboardPage = () => {
  const [auth, setAuth] = useState<StoredAuth | null>(() => loadAuth());
  const [profile, setProfile] = useState<string>('No profile loaded.');
  const [isLoading, setIsLoading] = useState(false);

  const loadProfile = async () => {
    if (!auth) {
      setProfile('Not logged in.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await callApi(
        '/v1/me',
        {
          method: 'GET',
          headers: {
            authorization: `Bearer ${auth.accessToken}`,
          },
        },
        (payload) => authUserSchema.parse(payload),
      );
      setProfile(`User ID: ${user.id} | Email: ${user.email}`);
    } catch (error) {
      const apiError = toApiError(error);
      setProfile(`Error: ${apiError.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    if (!auth) {
      clearAuth();
      return;
    }

    const refreshPayload = refreshTokenRequestSchema.parse({
      refreshToken: auth.refreshToken,
    });

    await callApi(
      '/v1/auth/logout',
      {
        method: 'POST',
        body: JSON.stringify(refreshPayload),
      },
      (payload) => payload,
    ).catch(() => undefined);

    clearAuth();
    setAuth(null);
    setProfile('Logged out.');
  };

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <h2>Dashboard</h2>
      <p>{auth ? `Session: ${auth.userEmail}` : 'No active session.'}</p>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button disabled={isLoading} onClick={() => void loadProfile()} type="button">
          {isLoading ? 'Loading...' : 'Load profile'}
        </button>
        <button onClick={() => void logout()} type="button">
          Logout
        </button>
      </div>
      <p>{profile}</p>
    </div>
  );
};

const ProviderConnectionsPage = () => {
  const [status, setStatus] = useState<string>('Not loaded.');
  const [oauthState, setOauthState] = useState<string>('');
  const [authUrl, setAuthUrl] = useState<string>('');
  const [isMockMode, setIsMockMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadIntegrationStatus = useCallback(async () => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus('Login required to manage provider connections.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await callApi(
        '/v1/integrations',
        {
          method: 'GET',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
        (payload) => integrationListResponseSchema.parse(payload),
      );

      const spotifyStatus = result.integrations.find((item) => item.provider === 'spotify');
      if (!spotifyStatus || spotifyStatus.status === 'not_connected') {
        setStatus('Spotify is not connected.');
      } else {
        setStatus(`Spotify connected. Expires at: ${spotifyStatus.expiresAt ?? 'unknown'}`);
      }
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startSpotifyConnect = async () => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus('Login required to start provider connection.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await callApi(
        '/v1/auth/spotify/start',
        {
          method: 'GET',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
        (payload) => oauthStartResponseSchema.parse(payload),
      );

      setOauthState(result.state);
      setAuthUrl(result.authorizationUrl);
      const mockMode = result.authorizationUrl.includes('/v1/auth/spotify/callback?');
      setIsMockMode(mockMode);
      setStatus(
        mockMode
          ? 'OAuth start created in mock mode. Use callback step to complete connection.'
          : 'OAuth start created. Open authorization page, approve, then reload status.',
      );
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const completeMockCallback = async () => {
    if (!oauthState) {
      setStatus('Start OAuth first to generate state.');
      return;
    }

    setIsLoading(true);
    try {
      const query = new URLSearchParams({
        state: oauthState,
        code: 'demo-auth-code',
        response_mode: 'json',
      });
      const result = await callApi(
        `/v1/auth/spotify/callback?${query.toString()}`,
        {
          method: 'GET',
        },
        (payload) => oauthCallbackResponseSchema.parse(payload),
      );
      setStatus(
        `${result.provider} connected at ${result.connectedAt}. Expires at: ${
          result.expiresAt ?? 'unknown'
        }`,
      );
      setOauthState('');
      await loadIntegrationStatus();
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('provider') === 'spotify' && params.get('status') === 'connected') {
      setStatus('Spotify OAuth completed. Loading latest connection state...');
      void loadIntegrationStatus();
      params.delete('provider');
      params.delete('status');
      const nextQuery = params.toString();
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`,
      );
    }
  }, [loadIntegrationStatus]);

  const disconnectSpotify = async () => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus('Login required to disconnect provider.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await callApi(
        '/v1/auth/spotify/disconnect',
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
        (payload) => integrationDisconnectResponseSchema.parse(payload),
      );
      setStatus(
        result.disconnected ? 'Spotify disconnected.' : 'Spotify was already disconnected.',
      );
      await loadIntegrationStatus();
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <h2>Provider Connections</h2>
      <p>{status}</p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button disabled={isLoading} onClick={() => void loadIntegrationStatus()} type="button">
          {isLoading ? 'Loading...' : 'Load status'}
        </button>
        <button disabled={isLoading} onClick={() => void startSpotifyConnect()} type="button">
          Start Spotify OAuth
        </button>
        {isMockMode ? (
          <button disabled={isLoading} onClick={() => void completeMockCallback()} type="button">
            Complete Callback (Mock)
          </button>
        ) : null}
        <button disabled={isLoading} onClick={() => void disconnectSpotify()} type="button">
          Disconnect Spotify
        </button>
      </div>
      {authUrl ? (
        <p>
          Spotify authorize URL:{' '}
          <a href={authUrl} rel="noreferrer" target="_blank">
            Open authorization page
          </a>
        </p>
      ) : null}
      <p>Supported providers in v1: {providerSchema.options.join(', ')}</p>
    </div>
  );
};

const EventCreatePage = () => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('Create an event to generate a magic link.');
  const [magicLinkUrl, setMagicLinkUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const createEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus('Login required to create events.');
      return;
    }

    setIsLoading(true);
    setMagicLinkUrl('');
    try {
      const result = await callApi(
        '/v1/events',
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            name,
            description,
          }),
        },
        (payload) => eventResponseSchema.parse(payload),
      );

      setStatus(`Event "${result.event.name}" created.`);
      setMagicLinkUrl(result.magicLinkUrl);
      setName('');
      setDescription('');
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '0.75rem', maxWidth: '36rem' }}>
      <h2>Create Event Playlist</h2>
      <form onSubmit={createEvent} style={{ display: 'grid', gap: '0.75rem' }}>
        <label>
          Event name
          <input
            required
            maxLength={100}
            value={name}
            onChange={(nextEvent) => setName(nextEvent.target.value)}
            style={{ width: '100%' }}
          />
        </label>
        <label>
          Description
          <textarea
            maxLength={500}
            value={description}
            onChange={(nextEvent) => setDescription(nextEvent.target.value)}
            style={{ width: '100%', minHeight: '5rem' }}
          />
        </label>
        <button disabled={isLoading} type="submit">
          {isLoading ? 'Creating...' : 'Create event'}
        </button>
      </form>
      <p>{status}</p>
      {magicLinkUrl ? (
        <p>
          Magic link: <a href={magicLinkUrl}>{magicLinkUrl}</a>
        </p>
      ) : null}
    </div>
  );
};

const HostEventsPage = () => {
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

const EventPublicPage = () => {
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

const rootRoute = createRootRoute({
  component: () => (
    <div style={{ fontFamily: 'ui-sans-serif, system-ui', margin: '2rem' }}>
      <h1>Synqit v1</h1>
      <nav style={{ display: 'flex', gap: '1rem' }}>
        <Link to="/">Home</Link>
        <Link to="/providers">Providers</Link>
        <Link to="/events">Events</Link>
        <Link to="/events/new">Create Event</Link>
        <Link to="/auth/register">Register</Link>
        <Link to="/auth/login">Login</Link>
        <Link to="/dashboard">Dashboard</Link>
      </nav>
      <hr style={{ margin: '1rem 0' }} />
      <Outlet />
    </div>
  ),
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => (
    <p>
      Auth foundation is wired. Next milestone: provider connection and event playlist creation
      flows.
    </p>
  ),
});

const providersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/providers',
  component: ProviderConnectionsPage,
});

const eventsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/events',
  component: HostEventsPage,
});

const eventCreateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/events/new',
  component: EventCreatePage,
});

const eventPublicRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/event/$magicLinkToken',
  component: EventPublicPage,
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/register',
  component: () => <AuthForm endpoint="/v1/auth/register" title="Register" />,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/login',
  component: () => <AuthForm endpoint="/v1/auth/login" title="Login" />,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: DashboardPage,
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  providersRoute,
  eventsRoute,
  eventCreateRoute,
  eventPublicRoute,
  registerRoute,
  loginRoute,
  dashboardRoute,
]);
const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
