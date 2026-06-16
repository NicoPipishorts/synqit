import { type SyntheticEvent } from 'react';

import { useI18n } from '../../hooks/useI18n';

// Real playlist screen grabs, served from apps/web/public/assets/presentation/.
// Shows the DARK grab in light mode and the LIGHT grab in dark mode so the
// product shot always contrasts with the page — same approach as the site hero.
const ASSET_BASE = '/assets/presentation';
const FALLBACK_SRC = `${ASSET_BASE}/Placeholder-Screenhot.png`;

const handleImageError = (event: SyntheticEvent<HTMLImageElement>) => {
  const img = event.currentTarget;
  if (!img.src.endsWith('Placeholder-Screenhot.png')) {
    img.src = FALLBACK_SRC;
  }
};

export const AuthHeroImage = () => {
  const { locale } = useI18n();

  return (
    <>
      <img
        src={`${ASSET_BASE}/create-account-screen-shot-dark-${locale}.png`}
        alt=""
        aria-hidden="true"
        loading="eager"
        onError={handleImageError}
        className="block h-full w-full object-cover object-left dark:hidden"
      />
      <img
        src={`${ASSET_BASE}/create-account-screen-shot-light-${locale}.png`}
        alt=""
        aria-hidden="true"
        loading="eager"
        onError={handleImageError}
        className="hidden h-full w-full object-cover object-left dark:block"
      />
    </>
  );
};
