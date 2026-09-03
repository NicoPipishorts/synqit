import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { bootstrapAuthSession } from './lib/auth';
import { registerServiceWorker } from './lib/pwa';
import './styles.css';

const CHUNK_RELOAD_KEY = 'synqit:chunk-reload-pending';

if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();

    try {
      const hasReloaded = window.sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1';
      if (hasReloaded) {
        window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
        return;
      }

      window.sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
    } catch {
      // Ignore storage issues and still attempt a hard reload.
    }

    window.location.reload();
  });

  try {
    window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    // Ignore storage issues.
  }
}

registerServiceWorker();

const root = createRoot(document.getElementById('root')!);

void bootstrapAuthSession().finally(() => {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
