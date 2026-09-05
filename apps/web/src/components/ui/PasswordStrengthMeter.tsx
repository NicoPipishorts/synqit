import {
  PasswordStrengthMeter as UiPasswordStrengthMeter,
  type PasswordStrengthLabels,
  type PasswordStrengthMeterProps as UiPasswordStrengthMeterProps,
} from '@synqit/ui';

import { useI18n } from '../../hooks/useI18n';

type PasswordStrengthMeterProps = Omit<UiPasswordStrengthMeterProps, 'labels'>;

/** App-bound PasswordStrengthMeter: supplies the localised labels. */
export const PasswordStrengthMeter = (props: PasswordStrengthMeterProps) => {
  const { t } = useI18n();
  const labels: PasswordStrengthLabels = {
    strength: t('auth.passwordStrengthLabel'),
    weak: t('auth.passwordStrengthWeak'),
    fair: t('auth.passwordStrengthFair'),
    good: t('auth.passwordStrengthGood'),
    strong: t('auth.passwordStrengthStrong'),
    criteriaTitle: t('profile.passwordCriteriaTitle'),
    criteriaLength: t('profile.passwordCriteriaLength'),
    criteriaCase: t('profile.passwordCriteriaCase'),
    criteriaNumber: t('profile.passwordCriteriaNumber'),
    criteriaSpecial: t('profile.passwordCriteriaSpecial'),
    tooltip: t('profile.passwordCriteriaTooltipLabel'),
    close: t('modal.close'),
  };
  return <UiPasswordStrengthMeter {...props} labels={labels} />;
};
