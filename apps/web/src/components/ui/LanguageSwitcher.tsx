import { useEffect, useRef, useState } from 'react';

import { useI18n } from '../../hooks/useI18n';
import { Locale } from '../../lib/i18n/messages';

type LanguageOption = {
  locale: Locale;
  iconSrc: string;
  iconAlt: string;
  nameKey: 'languageSwitcher.english' | 'languageSwitcher.french';
};

const LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    locale: 'en',
    iconSrc: '/assets/flags/USA.png',
    iconAlt: 'United States flag',
    nameKey: 'languageSwitcher.english',
  },
  {
    locale: 'fr',
    iconSrc: '/assets/flags/FR.png',
    iconAlt: 'French flag',
    nameKey: 'languageSwitcher.french',
  },
];

const FLAG_FRAME_CLASS =
  'h-5 w-7 overflow-hidden rounded-[5px] shadow-[0_1px_2px_rgba(0,0,0,0.22)]';
const FLAG_IMAGE_CLASS = 'h-full w-full object-cover';

export const LanguageSwitcher = () => {
  const { locale, setLocale, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onEscape);
    };
  }, []);

  const activeOption =
    LANGUAGE_OPTIONS.find((option) => option.locale === locale) ?? LANGUAGE_OPTIONS[0];

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((previousValue) => !previousValue)}
        aria-label={t('languageSwitcher.ariaOpen')}
        aria-expanded={isOpen}
        className="relative inline-flex h-12 w-12 items-center justify-center transition hover:opacity-80"
      >
        <span className={FLAG_FRAME_CLASS}>
          <img src={activeOption.iconSrc} alt={activeOption.iconAlt} className={FLAG_IMAGE_CLASS} />
        </span>
      </button>
      {isOpen ? (
        <div className="absolute left-1/2 z-30 mt-2 -translate-x-1/2 rounded-2xl border border-app-border bg-app-elevated p-1.5 shadow-xl dark:border-app-border dark:bg-app-card">
          {LANGUAGE_OPTIONS.map((option) => {
            const isActive = option.locale === locale;
            return (
              <button
                key={option.locale}
                type="button"
                onClick={() => {
                  setLocale(option.locale);
                  setIsOpen(false);
                }}
                aria-label={t('languageSwitcher.ariaSelect', { language: t(option.nameKey) })}
                className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2.5 text-left text-sm transition hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                  isActive ? 'bg-brand-lime/20 dark:bg-brand-lime/25' : ''
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={FLAG_FRAME_CLASS}>
                    <img src={option.iconSrc} alt={option.iconAlt} className={FLAG_IMAGE_CLASS} />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
