export type AppleDeveloperTokenResponse = {
  provider: 'apple';
  developerToken: string;
  musicKitIdentifier: string;
};

type MusicKitInstance = {
  authorize: () => Promise<string>;
};

declare global {
  interface Window {
    MusicKit?: {
      configure: (options: {
        developerToken: string;
        app: { name: string; build: string };
      }) => MusicKitInstance;
      getInstance?: () => MusicKitInstance;
    };
  }
}

let musicKitScriptPromise: Promise<void> | null = null;
let musicKitConfigured = false;

export const loadMusicKitScript = async (): Promise<void> => {
  if (window.MusicKit) {
    return;
  }

  if (!musicKitScriptPromise) {
    musicKitScriptPromise = new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[data-synqit-musickit="true"]',
      );
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener(
          'error',
          () => reject(new Error('MusicKit script failed to load.')),
          {
            once: true,
          },
        );
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js';
      script.async = true;
      script.defer = true;
      script.setAttribute('data-synqit-musickit', 'true');
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('MusicKit script failed to load.'));
      document.head.appendChild(script);
    });
  }

  await musicKitScriptPromise;
};

export const ensureMusicKitInstance = async (params: {
  developerToken: string;
  appName: string;
}): Promise<MusicKitInstance> => {
  if (!window.MusicKit) {
    throw new Error('MusicKit is not available in this browser.');
  }

  let maybeInstance: unknown;
  if (!musicKitConfigured) {
    const configureResult = window.MusicKit.configure({
      developerToken: params.developerToken,
      app: {
        name: params.appName || 'synqit',
        build: '0.1.0',
      },
    });
    const maybeThen = (configureResult as { then?: unknown } | undefined)?.then;
    if (typeof maybeThen === 'function') {
      maybeInstance = await Promise.resolve(configureResult as unknown);
    } else {
      maybeInstance = configureResult;
    }
    musicKitConfigured = true;
  }

  const instance =
    (maybeInstance &&
    typeof maybeInstance === 'object' &&
    'authorize' in maybeInstance &&
    typeof (maybeInstance as { authorize?: unknown }).authorize === 'function'
      ? (maybeInstance as MusicKitInstance)
      : null) ?? window.MusicKit.getInstance?.();
  if (!instance || typeof instance.authorize !== 'function') {
    throw new Error('MusicKit authorization is unavailable. Check Apple MusicKit setup and retry.');
  }

  return instance;
};
