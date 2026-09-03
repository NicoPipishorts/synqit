import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { bootstrapAdminAuthSession } from './lib/auth';
import './styles.css';

const root = createRoot(document.getElementById('root')!);

void bootstrapAdminAuthSession().finally(() => {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
