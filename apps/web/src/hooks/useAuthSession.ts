import { useEffect, useState } from 'react';

import { loadAuth } from '../lib/auth';
import { AUTH_CHANGED_EVENT } from '../lib/constants';
import { StoredAuth } from '../lib/types';

export const useAuthSession = () => {
  const [auth, setAuth] = useState<StoredAuth | null>(() => loadAuth());

  useEffect(() => {
    const syncAuth = () => setAuth(loadAuth());

    window.addEventListener(AUTH_CHANGED_EVENT, syncAuth);
    window.addEventListener('storage', syncAuth);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncAuth);
      window.removeEventListener('storage', syncAuth);
    };
  }, []);

  return {
    auth,
    setAuth,
  };
};
