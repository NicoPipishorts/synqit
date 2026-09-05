import type { GlobalProvider } from '@ladle/react';
import { useEffect } from 'react';

import './preview.css';

/** Mirrors the apps' `.dark` class strategy so Ladle's theme toggle drives our tokens. */
export const Provider: GlobalProvider = ({ children, globalState }) => {
  useEffect(() => {
    document.documentElement.classList.toggle('dark', globalState.theme === 'dark');
  }, [globalState.theme]);

  return <div className="min-h-screen bg-app-bg p-6 text-app-text">{children}</div>;
};
