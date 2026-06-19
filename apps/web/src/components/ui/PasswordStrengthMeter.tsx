import { Info } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useI18n } from '../../hooks/useI18n';
import { Modal } from './Modal';
import {
  getPasswordCriteria,
  getPasswordStrengthScore,
  isPasswordStrong,
} from '../../lib/client-models';

type PasswordStrengthMeterProps = {
  password: string;
  showTooltip?: boolean;
  className?: string;
  detailsOpen?: boolean;
  onDetailsOpenChange?: (open: boolean) => void;
};

const getStrengthLabelKey = (passwordStrengthScore: number): string => {
  if (passwordStrengthScore >= 4) {
    return 'auth.passwordStrengthStrong';
  }
  if (passwordStrengthScore >= 3) {
    return 'auth.passwordStrengthGood';
  }
  if (passwordStrengthScore >= 2) {
    return 'auth.passwordStrengthFair';
  }
  return 'auth.passwordStrengthWeak';
};

const getStrengthAccentClass = (passwordStrengthScore: number): string => {
  if (passwordStrengthScore >= 4) {
    return 'text-[#6d9600] dark:text-[#d5ff5c]';
  }
  if (passwordStrengthScore >= 3) {
    return 'text-[#86b300] dark:text-[#d5ff5c]';
  }
  if (passwordStrengthScore >= 2) {
    return 'text-[#b18400] dark:text-[#ffd95a]';
  }
  return 'text-[#b41563] dark:text-[#ff8ac0]';
};

export const PasswordStrengthMeter = ({
  password,
  showTooltip = false,
  className,
  detailsOpen,
  onDetailsOpenChange,
}: PasswordStrengthMeterProps) => {
  const { t } = useI18n();
  const [internalDetailsOpen, setInternalDetailsOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(min-width: 640px)').matches;
  });
  const criteria = getPasswordCriteria(password);
  const strengthScore = isPasswordStrong(password) ? 4 : getPasswordStrengthScore(password);
  const strengthLabelKey = getStrengthLabelKey(strengthScore);
  const strengthAccentClass = getStrengthAccentClass(strengthScore);
  const isDetailsOpen = detailsOpen ?? internalDetailsOpen;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(min-width: 640px)');
    const onChange = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches);
    };

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
    { key: 'length', label: t('profile.passwordCriteriaLength'), met: criteria.length },
    { key: 'case', label: t('profile.passwordCriteriaCase'), met: criteria.case },
    { key: 'number', label: t('profile.passwordCriteriaNumber'), met: criteria.number },
    { key: 'special', label: t('profile.passwordCriteriaSpecial'), met: criteria.special },
  ] as const;

  const detailsContent = (
    <div>
      <p className="text-xs font-semibold text-app-text">{t('profile.passwordCriteriaTitle')}</p>
      <ul className="mt-2 grid gap-1.5 text-xs">
        {criteriaItems.map((item) => (
          <li
            key={item.key}
            className={`flex items-start gap-2 ${
              item.met
                ? 'text-[#6d9600] dark:text-[#d5ff5c]'
                : 'text-[#b41563] dark:text-[#ff8ac0]'
            }`}
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
    <div className={className ? `grid gap-1.5 ${className}` : 'grid gap-1.5'}>
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-app-text-secondary">{t('auth.passwordStrengthLabel')}</span>
          {showTooltip ? (
            <div className="group relative">
              <button
                type="button"
                aria-label={t('profile.passwordCriteriaTooltipLabel')}
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
                  className={`absolute left-0 top-full z-[140] mt-2 w-64 rounded-xl border border-app-border bg-app-elevated p-3 shadow-soft-lift dark:bg-app-card ${
                    isDetailsOpen ? 'block' : 'hidden group-hover:block group-focus-within:block'
                  }`}
                >
                  {detailsContent}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <span className={`font-semibold ${strengthAccentClass}`}>{t(strengthLabelKey)}</span>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {Array.from({ length: 4 }, (_, index) => {
          const isActive = index < strengthScore;
          const activeClass =
            index < 2
              ? 'bg-brand-pink'
              : index === 2
                ? 'bg-[#ffc400]'
                : 'bg-brand-lime';
          return (
            <span
              key={index}
              className={`h-1.5 rounded-full transition ${
                isActive ? activeClass : 'bg-neutral-300/75 dark:bg-neutral-700/75'
              }`}
            />
          );
        })}
      </div>
      {!isDesktop && showTooltip ? (
        <Modal
          open={isDetailsOpen}
          title={t('profile.passwordCriteriaTitle')}
          onClose={() => setDetailsOpen(false)}
          panelClassName="max-w-md"
        >
          {detailsContent}
        </Modal>
      ) : null}
    </div>
  );
};
