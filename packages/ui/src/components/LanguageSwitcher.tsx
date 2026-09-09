import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { getViewportObstructions } from '../hooks/useFloatingBar';
import { cn } from '../utils/cn';

export type LanguageOption<L extends string = string> = {
  locale: L;
  iconSrc: string;
  iconAlt: string;
  /** Human-readable language name, used for the option's accessible label. */
  name: string;
};

type LanguageSwitcherProps<L extends string> = {
  value: L;
  options: readonly LanguageOption<L>[];
  onChange: (locale: L) => void;
  /** Accessible label of the trigger button. */
  openLabel: string;
  /** Builds the accessible label of an option from its name. */
  selectLabel?: (name: string) => string;
  className?: string;
};

const FLAG_FRAME_CLASS =
  'h-5 w-7 overflow-hidden rounded-[5px] shadow-[0_1px_2px_rgba(0,0,0,0.22)]';
const FLAG_IMAGE_CLASS = 'h-full w-full object-cover';

const EDGE_GAP = 8;

type MenuPlacement = {
  openUp: boolean;
  align: 'left' | 'center' | 'right';
  /** False until the menu has been measured, so it never paints mispositioned. */
  isPlaced: boolean;
};

const INITIAL_PLACEMENT: MenuPlacement = { openUp: false, align: 'center', isPlaced: false };

/** Flag dropdown for switching locale. Controlled: apps own the locale state. */
export const LanguageSwitcher = <L extends string>({
  value,
  options,
  onChange,
  openLabel,
  selectLabel = (name) => name,
  className,
}: LanguageSwitcherProps<L>) => {
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState<MenuPlacement>(INITIAL_PLACEMENT);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

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

  // Place the menu against the space the viewport actually leaves free: floating
  // bars (the mobile dock) cover the bottom edge, so measure the real menu and
  // flip it above the trigger rather than open it under the dock.
  useLayoutEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const place = () => {
      const trigger = containerRef.current?.getBoundingClientRect();
      const menu = menuRef.current?.getBoundingClientRect();
      if (!trigger || !menu) {
        return;
      }

      const obstructions = getViewportObstructions();
      const spaceBelow = window.innerHeight - obstructions.bottom - trigger.bottom;
      const spaceAbove = trigger.top - obstructions.top;
      const openUp = spaceBelow < menu.height + EDGE_GAP && spaceAbove > spaceBelow;

      const centerX = trigger.left + trigger.width / 2;
      let align: MenuPlacement['align'] = 'center';
      if (centerX - menu.width / 2 < EDGE_GAP) {
        align = 'left';
      } else if (centerX + menu.width / 2 > window.innerWidth - EDGE_GAP) {
        align = 'right';
      }

      setPlacement({ openUp, align, isPlaced: true });
    };

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [isOpen]);

  const activeOption = options.find((option) => option.locale === value) ?? options[0];

  const toggleOpen = () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    setPlacement(INITIAL_PLACEMENT);
    setIsOpen(true);
  };

  const verticalClass = placement.openUp ? 'bottom-full mb-2' : 'top-full mt-2';
  const horizontalClass =
    placement.align === 'center'
      ? 'left-1/2 -translate-x-1/2'
      : placement.align === 'left'
        ? 'left-0'
        : 'right-0';

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      <button
        type="button"
        onClick={toggleOpen}
        aria-label={openLabel}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:opacity-80 focus-ring-brand"
      >
        <span className={FLAG_FRAME_CLASS}>
          <img
            src={activeOption?.iconSrc}
            alt={activeOption?.iconAlt ?? ''}
            className={FLAG_IMAGE_CLASS}
          />
        </span>
      </button>
      {isOpen ? (
        <div
          ref={menuRef}
          role="listbox"
          aria-label={openLabel}
          className={cn(
            // Above the floating mobile dock (z-50): when neither side has room,
            // an overlapping menu still has to take the taps.
            'absolute z-[60] rounded-2xl border border-brand-white/20 bg-brand-dark p-1.5 shadow-xl dark:border-brand-dark/20 dark:bg-brand-white',
            verticalClass,
            horizontalClass,
            !placement.isPlaced && 'invisible',
          )}
        >
          {options.map((option) => {
            const isActive = option.locale === value;
            return (
              <button
                key={option.locale}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  onChange(option.locale);
                  setIsOpen(false);
                }}
                aria-label={selectLabel(option.name)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-xl px-2.5 py-2.5 text-left text-sm transition hover:bg-brand-white/10 dark:hover:bg-brand-dark/10',
                  isActive && 'bg-brand-lime/20',
                )}
              >
                <span className={FLAG_FRAME_CLASS}>
                  <img src={option.iconSrc} alt={option.iconAlt} className={FLAG_IMAGE_CLASS} />
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
