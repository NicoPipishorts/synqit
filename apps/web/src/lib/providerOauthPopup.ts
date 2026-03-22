import { oauthStartResponseSchema, Provider } from '@synqit/shared';

import { callApi } from './api';

export const PROVIDER_OAUTH_MESSAGE_TYPE = 'synqit-provider-oauth';

type ProviderOauthPopupMessage = {
  type: typeof PROVIDER_OAUTH_MESSAGE_TYPE;
  provider: Provider;
  status: 'connected' | 'error';
};

export type ProviderOauthPopupResult = 'connected' | 'error' | 'closed' | 'blocked' | 'timeout';

const POPUP_TIMEOUT_MS = 180_000;
const POPUP_POLL_INTERVAL_MS = 350;

export const openProviderOauthPopup = async (params: {
  provider: Provider;
  accessToken: string;
  nextPath?: string;
}): Promise<ProviderOauthPopupResult> => {
  const nextPath = params.nextPath ?? '/auth/provider-connected';
  const popup = window.open(
    '',
    `synqit-${params.provider}-oauth`,
    'width=520,height=760,resizable=yes,scrollbars=yes',
  );
  if (!popup) {
    return 'blocked';
  }

  popup.document.title = 'Synqit';
  popup.document.body.innerHTML =
    '<div style="font-family: system-ui, sans-serif; padding: 24px; color: #111827;">Connecting…</div>';

  const startResponse = await callApi(
    `/v1/auth/${params.provider}/start?next=${encodeURIComponent(nextPath)}`,
    {
      method: 'GET',
      headers: {
        authorization: `Bearer ${params.accessToken}`,
      },
    },
    (payload) => oauthStartResponseSchema.parse(payload),
  );
  popup.location.href = startResponse.authorizationUrl;
  popup.focus();

  return new Promise<ProviderOauthPopupResult>((resolve) => {
    let isSettled = false;

    const settle = (result: ProviderOauthPopupResult) => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      window.removeEventListener('message', onMessage);
      window.clearInterval(closedPollIntervalId);
      window.clearTimeout(timeoutId);
      resolve(result);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }
      const data = event.data as Partial<ProviderOauthPopupMessage>;
      if (
        data.type !== PROVIDER_OAUTH_MESSAGE_TYPE ||
        data.provider !== params.provider ||
        (data.status !== 'connected' && data.status !== 'error')
      ) {
        return;
      }

      try {
        popup.close();
      } catch {
        // No-op.
      }
      settle(data.status);
    };

    const closedPollIntervalId = window.setInterval(() => {
      if (popup.closed) {
        settle('closed');
      }
    }, POPUP_POLL_INTERVAL_MS);

    const timeoutId = window.setTimeout(() => {
      try {
        popup.close();
      } catch {
        // No-op.
      }
      settle('timeout');
    }, POPUP_TIMEOUT_MS);

    window.addEventListener('message', onMessage);
  });
};
