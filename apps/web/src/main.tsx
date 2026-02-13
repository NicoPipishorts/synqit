import {
  ApiError,
  authResponseSchema,
  authUserSchema,
  integrationDisconnectResponseSchema,
  integrationListResponseSchema,
  oauthCallbackResponseSchema,
  oauthStartResponseSchema,
  providerSchema,
  refreshTokenRequestSchema,
} from '@synqit/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Link,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
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
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
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

const rootRoute = createRootRoute({
  component: () => (
    <div style={{ fontFamily: 'ui-sans-serif, system-ui', margin: '2rem' }}>
      <h1>Synqit v1</h1>
      <nav style={{ display: 'flex', gap: '1rem' }}>
        <Link to="/">Home</Link>
        <Link to="/providers">Providers</Link>
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
