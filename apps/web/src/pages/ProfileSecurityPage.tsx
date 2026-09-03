import { isPasswordStrong, PASSWORD_MIN_LENGTH } from '@synqit/shared';
import { Trash2 } from 'lucide-react';
import { FormEvent, useState } from 'react';

import { AppPageHeader } from '../components/app/AppPageHeader';
import { AppPageLayout } from '../components/app/AppPageLayout';
import { AppSurfaceCard } from '../components/app/AppSurfaceCard';
import { CTAButton, CTAMobileIconLabel } from '../components/ui/cta';
import { Modal } from '../components/ui/Modal';
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
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const deleteConfirmationWord = t('profile.deleteAccountConfirmationWord').trim().toUpperCase();
  const isDeleteConfirmationValid =
    deleteConfirmation.trim().toUpperCase() === deleteConfirmationWord;

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

  const openDeleteModal = () => {
    setDeleteConfirmation('');
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setDeleteConfirmation('');
    setIsDeleteModalOpen(false);
  };

  const confirmDeleteFlow = () => {
    if (!isDeleteConfirmationValid) {
      showToast(t('profile.deleteAccountTypePrompt', { value: deleteConfirmationWord }), {
        variant: 'error',
      });
      return;
    }

    showToast(t('profile.deleteAccountSoon'), { variant: 'error' });
    closeDeleteModal();
  };

  return (
    <AppPageLayout>
      <AppPageHeader
        backTo="/profile"
        backLabel={t('profile.backToProfile')}
        title={t('profile.securityTitle')}
        description={t('profile.securityDescription')}
      />

      <AppSurfaceCard>
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
      </AppSurfaceCard>

      <AppSurfaceCard className="flex flex-col">
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
      </AppSurfaceCard>

      <article className="flex flex-col rounded-2xl border border-brand-pink/40 bg-brand-pink/5 p-5 shadow-soft-lift dark:bg-brand-pink/10">
        <h2 className="text-xl font-bold text-brand-dark dark:text-brand-white">
          {t('profile.deleteZoneTitle')}
        </h2>
        <p className="mt-2 text-sm text-app-text-secondary">{t('profile.deleteZoneBody')}</p>
        <CTAButton
          type="button"
          onClick={openDeleteModal}
          variant="danger"
          className="mt-auto self-end"
          aria-label={t('profile.deleteAccount')}
        >
          <CTAMobileIconLabel icon={<Trash2 size={14} />} label={t('profile.deleteAccount')} />
        </CTAButton>
      </article>

      <Modal
        open={isDeleteModalOpen}
        title={t('profile.deleteAccountModalTitle')}
        onClose={closeDeleteModal}
      >
        <div className="grid gap-4">
          <p className="text-base font-semibold leading-6 text-app-text-secondary">
            {t('profile.deleteAccountModalBody')}
          </p>

          <label className="grid gap-2 text-sm font-medium">
            <span>{t('profile.deleteAccountTypeLabel', { value: deleteConfirmationWord })}</span>
            <input
              type="text"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              placeholder={deleteConfirmationWord}
              className="w-full rounded-xl border border-app-border bg-app-bg px-3 py-2.5 text-base leading-6 text-app-text outline-none transition focus:border-brand-pink dark:bg-app-elevated"
            />
          </label>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <CTAButton type="button" onClick={closeDeleteModal} variant="secondary">
              {t('profile.cancel')}
            </CTAButton>
            <CTAButton
              type="button"
              onClick={confirmDeleteFlow}
              disabled={!isDeleteConfirmationValid}
              variant="danger"
            >
              {t('profile.deleteAccountConfirm')}
            </CTAButton>
          </div>
        </div>
      </Modal>
    </AppPageLayout>
  );
};
