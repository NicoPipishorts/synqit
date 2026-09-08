import { useEffect, useState } from 'react';

/** Below Tailwind's `sm`, i.e. phones. */
const PHONE_QUERY = '(max-width: 639.98px)';

/**
 * True on phone-width viewports.
 *
 * Used to skip rendering work rather than hide it: the hero's phone mockups
 * pre-warm ten images on mount and run a swap timer, and `hidden` would still
 * pay for all of it.
 */
export const useIsPhone = () => {
  const [isPhone, setIsPhone] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(PHONE_QUERY).matches,
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const mediaQuery = window.matchMedia(PHONE_QUERY);
    const onChange = (event: MediaQueryListEvent) => setIsPhone(event.matches);
    setIsPhone(mediaQuery.matches);
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

  return isPhone;
};
