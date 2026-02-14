import { useEffect, useState } from 'react';

import { PROFILE_SETTINGS_CHANGED_EVENT } from '../lib/constants';
import { ProfileSettings, loadProfileSettings, saveProfileSettings } from '../lib/profile-settings';

export const useProfileSettings = () => {
  const [settings, setSettings] = useState<ProfileSettings>(() => loadProfileSettings());

  useEffect(() => {
    const syncSettings = () => {
      setSettings(loadProfileSettings());
    };

    window.addEventListener(PROFILE_SETTINGS_CHANGED_EVENT, syncSettings);
    window.addEventListener('storage', syncSettings);
    return () => {
      window.removeEventListener(PROFILE_SETTINGS_CHANGED_EVENT, syncSettings);
      window.removeEventListener('storage', syncSettings);
    };
  }, []);

  const updateSettings = (patch: Partial<ProfileSettings>) => {
    const next = saveProfileSettings(patch);
    setSettings(next);
    return next;
  };

  return {
    settings,
    updateSettings,
  };
};
