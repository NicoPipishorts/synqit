import { Info } from 'lucide-react';

import { useI18n } from '../../hooks/useI18n';
import { getPasswordCriteria, getPasswordStrengthScore } from '../../lib/client-models';

type PasswordStrengthMeterProps = {
  password: string;
  showTooltip?: boolean;
  className?: string;
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

const getBarActiveClass = (passwordStrengthScore: number): string => {
  if (passwordStrengthScore >= 4) {
    return 'bg-brand-lime';
  }
  if (passwordStrengthScore >= 3) {
    return 'bg-brand-lime/70';
  }
  if (passwordStrengthScore >= 2) {
    return 'bg-[#ffc400]';
  }
  return 'bg-brand-pink';
};

export const PasswordStrengthMeter = ({
  password,
  showTooltip = false,
  className,
}: PasswordStrengthMeterProps) => {
  const { t } = useI18n();
  const criteria = getPasswordCriteria(password);
  const strengthScore = getPasswordStrengthScore(password);
  const strengthLabelKey = getStrengthLabelKey(strengthScore);
  const strengthAccentClass = getStrengthAccentClass(strengthScore);
  const barActiveClass = getBarActiveClass(strengthScore);

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
                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-app-border bg-app-elevated text-app-text-secondary transition hover:border-brand-lime hover:text-app-text focus-ring-brand dark:bg-app-card"
              >
                <Info size={10} aria-hidden="true" />
              </button>
              <div
                role="tooltip"
                className="absolute left-0 top-full z-[140] mt-2 hidden w-64 rounded-xl border border-app-border bg-app-elevated p-3 shadow-soft-lift group-hover:block group-focus-within:block dark:bg-app-card"
              >
                <p className="text-xs font-semibold text-app-text">
                  {t('profile.passwordCriteriaTitle')}
                </p>
                <ul className="mt-1 grid gap-1 text-xs text-app-text-secondary">
                  <li
                    className={`transition-colors ${
                      criteria.length
                        ? 'group-hover:text-[#6d9600] group-focus-within:text-[#6d9600] dark:group-hover:text-[#d5ff5c] dark:group-focus-within:text-[#d5ff5c]'
                        : ''
                    }`}
                  >
                    {t('profile.passwordCriteriaLength')}
                  </li>
                  <li
                    className={`transition-colors ${
                      criteria.case
                        ? 'group-hover:text-[#6d9600] group-focus-within:text-[#6d9600] dark:group-hover:text-[#d5ff5c] dark:group-focus-within:text-[#d5ff5c]'
                        : ''
                    }`}
                  >
                    {t('profile.passwordCriteriaCase')}
                  </li>
                  <li
                    className={`transition-colors ${
                      criteria.number
                        ? 'group-hover:text-[#6d9600] group-focus-within:text-[#6d9600] dark:group-hover:text-[#d5ff5c] dark:group-focus-within:text-[#d5ff5c]'
                        : ''
                    }`}
                  >
                    {t('profile.passwordCriteriaNumber')}
                  </li>
                  <li
                    className={`transition-colors ${
                      criteria.special
                        ? 'group-hover:text-[#6d9600] group-focus-within:text-[#6d9600] dark:group-hover:text-[#d5ff5c] dark:group-focus-within:text-[#d5ff5c]'
                        : ''
                    }`}
                  >
                    {t('profile.passwordCriteriaSpecial')}
                  </li>
                </ul>
              </div>
            </div>
          ) : null}
        </div>
        <span className={`font-semibold ${strengthAccentClass}`}>{t(strengthLabelKey)}</span>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {Array.from({ length: 4 }, (_, index) => {
          const isActive = index < strengthScore;
          return (
            <span
              key={index}
              className={`h-1.5 rounded-full transition ${
                isActive ? barActiveClass : 'bg-neutral-300/75 dark:bg-neutral-700/75'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
};
