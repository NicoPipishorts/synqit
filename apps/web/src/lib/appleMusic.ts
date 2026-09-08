/**
 * Shared Apple Music connect flow.
 * Used by both the profile connections panel and EventCreatePage.
 */
import { callApi } from './api';
import {
  AppleDeveloperTokenResponse,
  ensureMusicKitInstance,
  loadMusicKitScript,
} from './musickit';
import { requireToken } from './queries';
import { connectAppleToBackend } from './queries';

export const connectAppleMusic = async (): Promise<void> => {
  const token = requireToken();

  const tokenResponse = await callApi(
    '/v1/auth/apple/developer-token',
    { method: 'GET', headers: { authorization: `Bearer ${token}` } },
    (payload) => {
      const value = payload as Partial<AppleDeveloperTokenResponse>;
      if (
        value &&
        value.provider === 'apple' &&
        typeof value.developerToken === 'string' &&
        typeof value.musicKitIdentifier === 'string'
      ) {
        return value as AppleDeveloperTokenResponse;
      }
      throw new Error('invalid_apple_developer_token_response');
    },
  );

  await loadMusicKitScript();
  const musicKit = await ensureMusicKitInstance({
    developerToken: tokenResponse.developerToken,
    appName: tokenResponse.musicKitIdentifier || 'synqit',
  });

  const musicUserToken = await musicKit.authorize();
  if (!musicUserToken) {
    throw new Error('apple_music_user_token_missing');
  }

  await connectAppleToBackend(musicUserToken);
};
