import { isPasswordStrong, PASSWORD_MIN_LENGTH } from '@synqit/shared';
import { FormEvent, useState } from 'react';

import { CircleChevronBackButton } from '../components/ui/CircleChevronBackButton';
import { CTAButton } from '../components/ui/cta';
import { PasswordField } from '../components/ui/PasswordField';
import { PasswordStrengthMeter } from '../components/ui/PasswordStrengthMeter';
import { useAuthSession } from '../hooks/useAuthSession';
import { useI18n } from '../hooks/useI18n';
import { useToast } from '../hooks/useToast';
import { callApi, toApiError } from '../lib/api';

export const ProfileSecurityPage = () => {
  const { t } = useI18n();
  const { auth } = useAuthSession();
  const { showToast } = useToast();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!auth) {
      showToast(t('profile.notLoggedIn'), { variant: 'error' });
      return;
    }

    if (!isPasswordStrong(newPassword)) {
      showToast(t('profile.passwordCriteriaNotMet'), { variant: 'error' });
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast(t('profile.passwordMismatch'), { variant: 'error' });
      return;
    }

    setIsChangingPassword(true);
    try {
      await callApi(
        '/v1/auth/change-password',
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${auth.accessToken}`,
          },
          body: JSON.stringify({
            currentPassword,
            newPassword,
          }),
        },
        (payload) => payload,
      );

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast(t('profile.passwordChanged'), { variant: 'success' });
    } catch (error) {
      const apiError = toApiError(error);
      showToast(t('profile.error', { message: apiError.message }), { variant: 'error' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <section className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:px-8">
      <div className="relative grid gap-6">
        <article>
          <div className="flex items-start gap-4 px-5 py-7 sm:px-8 sm:py-9">
            <CircleChevronBackButton to="/profile" label={t('profile.backToProfile')} />
            <div className="grid gap-1">
              <h1 className="text-2xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-5xl">
                {t('profile.securityTitle')}
              </h1>
              <p className="text-sm text-app-text-secondary sm:text-base">
                {t('profile.securityDescription')}
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card">
          <h2 className="text-xl font-bold text-brand-dark dark:text-brand-white">
            {t('profile.changePassword')}
          </h2>
          <form onSubmit={changePassword} className="mt-4 grid w-full gap-3">
            <PasswordField
              value={currentPassword}
              onChange={setCurrentPassword}
              placeholder={t('profile.currentPassword')}
              inputClassName="w-full rounded-xl border border-app-border bg-app-bg px-3 py-2 pr-10 text-app-text outline-none transition focus:border-brand-pink dark:bg-app-elevated"
              autoComplete="current-password"
              required
            />
            <PasswordField
              value={newPassword}
              onChange={setNewPassword}
              placeholder={t('profile.newPassword')}
              inputClassName="w-full rounded-xl border border-app-border bg-app-bg px-3 py-2 pr-10 text-app-text outline-none transition focus:border-brand-pink dark:bg-app-elevated"
              autoComplete="new-password"
              required
              minLength={PASSWORD_MIN_LENGTH}
            />
            <PasswordStrengthMeter password={newPassword} showTooltip />
            <PasswordField
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder={t('profile.confirmPassword')}
              inputClassName="w-full rounded-xl border border-app-border bg-app-bg px-3 py-2 pr-10 text-app-text outline-none transition focus:border-brand-pink dark:bg-app-elevated"
              autoComplete="new-password"
              required
              minLength={PASSWORD_MIN_LENGTH}
            />
            <div className="mt-1 flex justify-end">
              <CTAButton type="submit" disabled={isChangingPassword} variant="primary">
                {isChangingPassword ? t('profile.changingPassword') : t('profile.changePassword')}
              </CTAButton>
            </div>
          </form>
        </article>

        <article className="flex flex-col rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card">
          <h2 className="text-xl font-bold text-brand-dark dark:text-brand-white">
            {t('profile.otpTitle')}
          </h2>
          <p className="mt-2 text-sm text-app-text-secondary">{t('profile.otpBody')}</p>
          <CTAButton
            type="button"
            onClick={() => showToast(t('profile.otpSoon'), { variant: 'info' })}
            variant="secondary"
            className="mt-auto self-end"
          >
            {t('profile.otpCta')}
          </CTAButton>
        </article>

        <article className="flex flex-col rounded-2xl border border-brand-pink/40 bg-brand-pink/5 p-5 shadow-soft-lift dark:bg-brand-pink/10">
          <h2 className="text-xl font-bold text-brand-dark dark:text-brand-white">
            {t('profile.deleteZoneTitle')}
          </h2>
          <p className="mt-2 text-sm text-app-text-secondary">{t('profile.deleteZoneBody')}</p>
          <CTAButton
            type="button"
            onClick={() => showToast(t('profile.deleteAccountSoon'), { variant: 'error' })}
            variant="danger"
            className="mt-auto self-end"
          >
            {t('profile.deleteAccount')}
          </CTAButton>
        </article>
      </div>
    </section>
  );
};
