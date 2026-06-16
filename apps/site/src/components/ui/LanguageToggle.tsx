import { useEffect, useRef, useState } from 'react';

import { useI18n } from '../../lib/i18n';

type Locale = 'en' | 'fr';

const LANGUAGE_OPTIONS: { locale: Locale; iconSrc: string; iconAlt: string }[] = [
  { locale: 'en', iconSrc: '/assets/flags/USA.png', iconAlt: 'United States flag' },
  { locale: 'fr', iconSrc: '/assets/flags/FR.png', iconAlt: 'French flag' },
];

const FLAG_FRAME_CLASS =
  'h-5 w-7 overflow-hidden rounded-[5px] shadow-[0_1px_2px_rgba(0,0,0,0.22)]';

// Approximate rendered menu size, used to decide which way to open so the
// dropdown never overflows the viewport edges.
const MENU_WIDTH = 76;
const MENU_HEIGHT = 120;
const EDGE_GAP = 8;

type MenuPosition = { openUp: boolean; align: 'left' | 'center' | 'right' };

export const LanguageToggle = () => {
  const { locale, setLocale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({
    openUp: false,
    align: 'center',
  });
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onEscape);
    };
  }, []);

  const activeOption = LANGUAGE_OPTIONS.find((o) => o.locale === locale) ?? LANGUAGE_OPTIONS[0];

  const toggleOpen = () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < MENU_HEIGHT + EDGE_GAP;

      const centerX = rect.left + rect.width / 2;
      let align: MenuPosition['align'] = 'center';
      if (centerX - MENU_WIDTH / 2 < EDGE_GAP) {
        align = 'left';
      } else if (centerX + MENU_WIDTH / 2 > window.innerWidth - EDGE_GAP) {
        align = 'right';
      }

      setMenuPosition({ openUp, align });
    }

    setIsOpen(true);
  };

  const verticalClass = menuPosition.openUp ? 'bottom-full mb-2' : 'top-full mt-2';
  const horizontalClass =
    menuPosition.align === 'center'
      ? 'left-1/2 -translate-x-1/2'
      : menuPosition.align === 'left'
        ? 'left-0'
        : 'right-0';

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={toggleOpen}
        aria-label="Select language"
        aria-expanded={isOpen}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:opacity-80"
      >
        <span className={FLAG_FRAME_CLASS}>
          <img
            src={activeOption.iconSrc}
            alt={activeOption.iconAlt}
            className="h-full w-full object-cover"
          />
        </span>
      </button>
      {isOpen && (
        <div
          className={`absolute z-30 rounded-2xl border border-brand-white/20 bg-brand-dark p-1.5 shadow-xl dark:border-brand-dark/20 dark:bg-brand-white ${verticalClass} ${horizontalClass}`}
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <button
              key={option.locale}
              type="button"
              onClick={() => {
                setLocale(option.locale);
                setIsOpen(false);
              }}
              aria-label={option.iconAlt}
              className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2.5 transition hover:bg-brand-white/10 dark:hover:bg-brand-dark/10 ${
                option.locale === locale ? 'bg-brand-lime/20' : ''
              }`}
            >
              <span className={FLAG_FRAME_CLASS}>
                <img
                  src={option.iconSrc}
                  alt={option.iconAlt}
                  className="h-full w-full object-cover"
                />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
