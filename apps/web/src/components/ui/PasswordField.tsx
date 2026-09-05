import {
  PasswordField as UiPasswordField,
  type PasswordFieldProps as UiPasswordFieldProps,
} from '@synqit/ui';

import { useI18n } from '../../hooks/useI18n';

type PasswordFieldProps = Omit<UiPasswordFieldProps, 'showPasswordLabel' | 'hidePasswordLabel'>;

/** App-bound PasswordField: injects localised visibility-toggle labels. */
export const PasswordField = (props: PasswordFieldProps) => {
  const { t } = useI18n();
  return (
    <UiPasswordField
      {...props}
      showPasswordLabel={t('profile.showPassword')}
      hidePasswordLabel={t('profile.hidePassword')}
    />
  );
};
