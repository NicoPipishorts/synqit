import { authUserSchema, refreshTokenRequestSchema } from '@synqit/shared';
import { useState } from 'react';

import { callApi, toApiError } from '../lib/api';
import { clearAuth, loadAuth } from '../lib/auth';
import { StoredAuth } from '../lib/types';

export const DashboardPage = () => {
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
