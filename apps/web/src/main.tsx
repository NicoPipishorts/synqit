import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { registerServiceWorker } from './lib/pwa';
import './styles.css';

registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
