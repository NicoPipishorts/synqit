import { type SyntheticEvent } from 'react';

import { useI18n } from '../../lib/i18n';

// Real playlist screen grabs, served from the shared public dir
// (apps/web/public/assets/presentation/ — the site's configured publicDir).
// Files, one per theme × locale:
//   playlist-dark-en.png   playlist-dark-fr.png
//   playlist-light-en.png  playlist-light-fr.png
// We intentionally show the DARK grab in light mode and the LIGHT grab in dark
// mode, so the product shot always contrasts against the page background.

const ASSET_BASE = '/assets/presentation';
const FALLBACK_SRC = `${ASSET_BASE}/Placeholder-Screenhot.png`;

const handleImageError = (event: SyntheticEvent<HTMLImageElement>) => {
  const img = event.currentTarget;
  if (!img.src.endsWith('Placeholder-Screenhot.png')) {
    img.src = FALLBACK_SRC;
  }
};

export const HeroBackdrop = () => {
  const { locale } = useI18n();

  return (
    <div className="h-full w-full">
      <img
        src={`${ASSET_BASE}/above-the-fold-dark-${locale}.png`}
        alt=""
        aria-hidden="true"
        loading="eager"
        onError={handleImageError}
        className="block h-full w-full object-contain object-bottom lg:object-bottom-right dark:hidden"
      />
      <img
        src={`${ASSET_BASE}/above-the-fold-light-${locale}.png`}
        alt=""
        aria-hidden="true"
        loading="eager"
        onError={handleImageError}
        className="hidden h-full w-full object-contain object-bottom lg:object-bottom-right dark:block"
      />
    </div>
  );
};

export const HostWorkspaceBackdrop = () => {
  const { locale } = useI18n();

  return (
    <div className="h-full w-full">
      <img
        src={`${ASSET_BASE}/host-scree-dark-${locale}.png`}
        alt=""
        aria-hidden="true"
        loading="lazy"
        onError={handleImageError}
        className="block h-full w-full object-cover object-top dark:hidden"
      />
      <img
        src={`${ASSET_BASE}/host-scree-light-${locale}.png`}
        alt=""
        aria-hidden="true"
        loading="lazy"
        onError={handleImageError}
        className="hidden h-full w-full object-cover object-top dark:block"
      />
    </div>
  );
};
