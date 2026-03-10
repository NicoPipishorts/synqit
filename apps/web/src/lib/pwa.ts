const canRegisterServiceWorker = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  return (
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );
};

export const registerServiceWorker = (): void => {
  if (!canRegisterServiceWorker() || !('serviceWorker' in navigator)) {
    return;
  }

  const register = () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // Installability should not block the main app experience.
    });
  };

  if (document.readyState === 'complete') {
    register();
    return;
  }

  window.addEventListener('load', register, { once: true });
};
