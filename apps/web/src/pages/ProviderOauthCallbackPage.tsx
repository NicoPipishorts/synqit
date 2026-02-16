import { providerSchema, Provider } from '@synqit/shared';
import { useEffect } from 'react';

import { PROVIDER_OAUTH_MESSAGE_TYPE } from '../lib/providerOauthPopup';

export const ProviderOauthCallbackPage = () => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const providerParam = params.get('provider');
    const statusParam = params.get('status');

    if (providerParam && providerSchema.options.includes(providerParam as Provider)) {
      const provider = providerParam as Provider;
      const status = statusParam === 'connected' ? 'connected' : 'error';

      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          {
            type: PROVIDER_OAUTH_MESSAGE_TYPE,
            provider,
            status,
          },
          window.location.origin,
        );
      }
    }

    const closeTimeoutId = window.setTimeout(() => {
      window.close();
    }, 220);

    return () => {
      window.clearTimeout(closeTimeoutId);
    };
  }, []);

  return (
    <section className="mx-auto grid min-h-screen w-full max-w-md place-items-center px-6">
      <p className="text-sm text-app-text-secondary">Connection complete. This window can close.</p>
    </section>
  );
};
