import { getPasswordCriteria, getPasswordStrengthScore, isPasswordStrong } from '@synqit/shared';
import { Info } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Modal } from './Modal';
import { cn } from '../utils/cn';

export type PasswordStrengthLabels = {
  strength: string;
  weak: string;
  fair: string;
  good: string;
  strong: string;
  criteriaTitle: string;
  criteriaLength: string;
  criteriaCase: string;
  criteriaNumber: string;
  criteriaSpecial: string;
  tooltip: string;
  close: string;
};

export type PasswordStrengthMeterProps = {
  password: string;
  labels: PasswordStrengthLabels;
  showTooltip?: boolean;
  className?: string;
  detailsOpen?: boolean;
  onDetailsOpenChange?: (open: boolean) => void;
};

const DESKTOP_QUERY = '(min-width: 640px)';

const strengthLabel = (labels: PasswordStrengthLabels, score: number): string => {
  if (score >= 4) return labels.strong;
  if (score >= 3) return labels.good;
  if (score >= 2) return labels.fair;
  return labels.weak;
};

const strengthAccentClass = (score: number): string => {
  if (score >= 4) return 'text-[#6d9600] dark:text-[#d5ff5c]';
  if (score >= 3) return 'text-[#86b300] dark:text-[#d5ff5c]';
  if (score >= 2) return 'text-[#b18400] dark:text-[#ffd95a]';
  return 'text-[#b41563] dark:text-[#ff8ac0]';
};

/** Four-segment strength bar with optional criteria tooltip (dialog on small screens). */
export const PasswordStrengthMeter = ({
  password,
  labels,
  showTooltip = false,
  className,
  detailsOpen,
  onDetailsOpenChange,
}: PasswordStrengthMeterProps) => {
  const [internalDetailsOpen, setInternalDetailsOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(DESKTOP_QUERY).matches,
  );
  const criteria = getPasswordCriteria(password);
  const score = isPasswordStrong(password) ? 4 : getPasswordStrengthScore(password);
  const isDetailsOpen = detailsOpen ?? internalDetailsOpen;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const mediaQuery = window.matchMedia(DESKTOP_QUERY);
    const onChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    setIsDesktop(mediaQuery.matches);
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

  const setDetailsOpen = (open: boolean) => {
    if (detailsOpen === undefined) {
      setInternalDetailsOpen(open);
    }
    onDetailsOpenChange?.(open);
  };

  const criteriaItems = [
    { key: 'length', label: labels.criteriaLength, met: criteria.length },
    { key: 'case', label: labels.criteriaCase, met: criteria.case },
    { key: 'number', label: labels.criteriaNumber, met: criteria.number },
    { key: 'special', label: labels.criteriaSpecial, met: criteria.special },
  ] as const;

  const detailsContent = (
    <div>
      <p className="text-xs font-semibold text-app-text">{labels.criteriaTitle}</p>
      <ul className="mt-2 grid gap-1.5 text-xs">
        {criteriaItems.map((item) => (
          <li
            key={item.key}
            className={cn(
              'flex items-start gap-2',
              item.met
                ? 'text-[#6d9600] dark:text-[#d5ff5c]'
                : 'text-[#b41563] dark:text-[#ff8ac0]',
            )}
          >
            <span aria-hidden="true" className="mt-[2px] text-[10px] leading-none">
              {item.met ? '●' : '○'}
            </span>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className={cn('grid gap-1.5', className)}>
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-app-text-secondary">{labels.strength}</span>
          {showTooltip ? (
            <div className="group relative">
              <button
                type="button"
                aria-label={labels.tooltip}
                aria-expanded={isDetailsOpen}
                aria-haspopup="dialog"
                onClick={() => setDetailsOpen(!isDetailsOpen)}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-app-border bg-app-elevated text-app-text-secondary transition hover:border-brand-lime hover:text-app-text focus-ring-brand dark:bg-app-card"
              >
                <Info size={10} aria-hidden="true" />
              </button>
              {isDesktop ? (
                <div
                  role="tooltip"
                  className={cn(
                    'absolute left-0 top-full z-[140] mt-2 w-64 rounded-xl border border-app-border bg-app-elevated p-3 shadow-soft-lift dark:bg-app-card',
                    isDetailsOpen ? 'block' : 'hidden group-hover:block group-focus-within:block',
                  )}
                >
                  {detailsContent}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <span className={cn('font-semibold', strengthAccentClass(score))}>
          {strengthLabel(labels, score)}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => {
          const isActive = index < score;
          const activeClass =
            index < 2 ? 'bg-brand-pink' : index === 2 ? 'bg-[#ffc400]' : 'bg-brand-lime';
          return (
            <span
              key={index}
              className={cn(
                'h-1.5 rounded-full transition',
                isActive ? activeClass : 'bg-neutral-300/75 dark:bg-neutral-700/75',
              )}
            />
          );
        })}
      </div>
      {!isDesktop && showTooltip ? (
        <Modal
          open={isDetailsOpen}
          title={labels.criteriaTitle}
          onClose={() => setDetailsOpen(false)}
          closeLabel={labels.close}
          panelClassName="max-w-md"
        >
          {detailsContent}
        </Modal>
      ) : null}
    </div>
  );
};
