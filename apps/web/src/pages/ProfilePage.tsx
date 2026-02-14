import { authUserSchema, providerSchema } from '@synqit/shared';
import { Link } from '@tanstack/react-router';
import { Pencil } from 'lucide-react';
import { ChangeEvent, DragEvent, FormEvent, useRef, useState } from 'react';

import { Modal } from '../components/ui/Modal';
import { useAuthSession } from '../hooks/useAuthSession';
import { useI18n } from '../hooks/useI18n';
import { useProfileSettings } from '../hooks/useProfileSettings';
import { useTheme } from '../hooks/useTheme';
import { callApi, toApiError } from '../lib/api';
import { updateStoredAuthUser } from '../lib/auth';
import { applyThemeAccent } from '../lib/profile-settings';
import { Theme, ThemeAccent } from '../lib/types';

const MAX_AVATAR_BYTES = 1_500_000;

export const ProfilePage = () => {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const { auth, setAuth } = useAuthSession();
  const { settings, updateSettings } = useProfileSettings();

  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);
  const [passwordStatusType, setPasswordStatusType] = useState<'success' | 'error' | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isAvatarDragActive, setIsAvatarDragActive] = useState(false);
  const [avatarModalStatus, setAvatarModalStatus] = useState<string | null>(null);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const avatarSrc = auth?.avatarUrl ?? settings.avatarDataUrl ?? null;

  const onThemeChange = (nextTheme: Theme) => {
    setTheme(nextTheme);
    setProfileStatus(t('profile.themeSaved'));
  };

  const onAccentChange = (nextAccent: ThemeAccent) => {
    updateSettings({ themeAccent: nextAccent });
    applyThemeAccent(nextAccent);
    setProfileStatus(t('profile.accentSaved'));
  };

  const onProviderChange = (nextProvider: string) => {
    if (providerSchema.options.includes(nextProvider as (typeof providerSchema.options)[number])) {
      updateSettings({
        preferredProvider: nextProvider as (typeof providerSchema.options)[number],
      });
      setProfileStatus(t('profile.providerSaved'));
    }
  };

  const onLocaleChange = (nextLocale: 'en' | 'fr') => {
    setLocale(nextLocale);
    setProfileStatus(t('profile.languageSaved'));
  };

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : null;
        if (!result) {
          reject(new Error('invalid_avatar_data'));
          return;
        }
        resolve(result);
      };
      reader.onerror = () => reject(new Error('avatar_read_failed'));
      reader.readAsDataURL(file);
    });
  };

  const handleAvatarFile = async (file: File | null | undefined) => {
    if (!file) {
      return;
    }

    setAvatarModalStatus(null);
    if (!file.type.startsWith('image/')) {
      const message = t('profile.avatarInvalidType');
      setAvatarModalStatus(message);
      setProfileStatus(message);
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      const message = t('profile.avatarTooLarge');
      setAvatarModalStatus(message);
      setProfileStatus(message);
      return;
    }

    if (!auth) {
      const message = t('profile.notLoggedIn');
      setAvatarModalStatus(message);
      setProfileStatus(message);
      return;
    }

    setIsSavingAvatar(true);
    try {
      const imageDataUrl = await fileToDataUrl(file);
      const user = await callApi(
        '/v1/auth/avatar',
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${auth.accessToken}`,
          },
          body: JSON.stringify({
            imageDataUrl,
          }),
        },
        (payload) => authUserSchema.parse((payload as { user: unknown }).user),
      );

      updateSettings({ avatarDataUrl: undefined });
      const nextAuth = updateStoredAuthUser({
        avatarUrl: user.avatarUrl,
      });
      if (nextAuth) {
        setAuth(nextAuth);
      }

      const message = t('profile.avatarSaved');
      setProfileStatus(message);
      setAvatarModalStatus(message);
      setIsAvatarModalOpen(false);
    } catch (error) {
      const apiError = toApiError(error);
      const message =
        apiError.code === 'invalid_avatar_image'
          ? t('profile.avatarInvalidType')
          : t('profile.error', { message: apiError.message });
      setAvatarModalStatus(message);
      setProfileStatus(message);
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const onAvatarUpload = (event: ChangeEvent<HTMLInputElement>) => {
    void handleAvatarFile(event.target.files?.[0]);
  };

  const removeAvatar = async () => {
    if (!auth) {
      const message = t('profile.notLoggedIn');
      setAvatarModalStatus(message);
      setProfileStatus(message);
      return;
    }

    setIsSavingAvatar(true);
    try {
      const user = await callApi(
        '/v1/auth/avatar',
        {
          method: 'DELETE',
          headers: {
            authorization: `Bearer ${auth.accessToken}`,
          },
        },
        (payload) => authUserSchema.parse((payload as { user: unknown }).user),
      );

      updateSettings({ avatarDataUrl: undefined });
      const nextAuth = updateStoredAuthUser({
        avatarUrl: user.avatarUrl,
      });
      if (nextAuth) {
        setAuth(nextAuth);
      }

      const message = t('profile.avatarRemoved');
      setProfileStatus(message);
      setAvatarModalStatus(message);
    } catch (error) {
      const apiError = toApiError(error);
      const message = t('profile.error', { message: apiError.message });
      setAvatarModalStatus(message);
      setProfileStatus(message);
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const onAvatarDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsAvatarDragActive(false);

    void handleAvatarFile(event.dataTransfer.files?.[0]);
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordStatus(null);
    setPasswordStatusType(null);

    if (!auth) {
      setPasswordStatus(t('profile.notLoggedIn'));
      setPasswordStatusType('error');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordStatus(t('profile.passwordMinLength'));
      setPasswordStatusType('error');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus(t('profile.passwordMismatch'));
      setPasswordStatusType('error');
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
      setPasswordStatus(t('profile.passwordChanged'));
      setPasswordStatusType('success');
    } catch (error) {
      const apiError = toApiError(error);
      setPasswordStatus(t('profile.error', { message: apiError.message }));
      setPasswordStatusType('error');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <section className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:px-8">
      <div className="pointer-events-none absolute -left-12 top-16 h-44 w-44 rounded-full " />
      <div className="pointer-events-none absolute right-0 top-16 h-52 w-52 rounded-full " />

      <div className="relative grid gap-6">
        <article className=" ">
          <div className="flex flex-wrap items-start justify-between gap-6  px-5 py-7 dark:bg-app-card sm:px-8 sm:py-9">
            <div className="grid gap-2">
              <h1 className="text-2xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-5xl">
                Profile
              </h1>
              <p className="text-sm text-app-text-secondary">
                {auth ? auth.userEmail : t('profile.notLoggedIn')}
              </p>
            </div>

            <div className="relative">
              <div className="rounded-full bg-brand-gradient p-[2px]">
                <div className="h-28 w-28 overflow-hidden rounded-full border border-app-border bg-app-bg sm:h-32 sm:w-32">
                  {avatarSrc ? (
                    <img
                      src={avatarSrc}
                      alt={t('profile.avatarAlt')}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-app-text-muted">
                      {t('profile.noAvatar')}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(true)}
                className="absolute -bottom-2 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-app-border bg-app-elevated px-3 py-1 text-xs font-semibold shadow-soft-lift transition hover:border-brand-pink dark:bg-app-card"
              >
                {t('profile.editAvatar')}
                <Pencil className="h-3.5 w-3.5 sm:hidden" aria-hidden="true" />
              </button>
            </div>
          </div>
        </article>
        {profileStatus ? (
          <p className="w-fit rounded-lg border border-brand-lime/35 bg-brand-lime/10 px-3 py-2 text-sm text-[#6d9600] dark:text-[#d5ff5c]">
            {profileStatus}
          </p>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-2">
          <article className="rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card">
            <h2 className="text-xl font-bold text-brand-dark dark:text-brand-white">
              {t('profile.accountTitle')}
            </h2>
            <div className="mt-4 grid gap-4">
              <p className="text-sm text-app-text-secondary">
                {t('profile.emailLabel')}: {auth?.userEmail ?? t('profile.notLoggedIn')}
              </p>
              <p className="text-sm text-app-text-secondary">
                {t('profile.avatarManagedInHeader')}
              </p>
            </div>
          </article>

          <article className="rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card">
            <h2 className="text-xl font-bold text-brand-dark dark:text-brand-white">
              {t('profile.preferencesTitle')}
            </h2>
            <div className="mt-4 grid gap-4">
              <label className="grid gap-1 text-sm">
                <span>{t('profile.providerLabel')}</span>
                <select
                  value={settings.preferredProvider ?? 'spotify'}
                  onChange={(event) => onProviderChange(event.target.value)}
                  className="rounded-xl border border-app-border bg-app-bg px-3 py-2 text-app-text outline-none transition focus:border-brand-lime dark:bg-app-elevated"
                >
                  {providerSchema.options.map((provider) => (
                    <option key={provider} value={provider}>
                      {provider}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span>{t('profile.languageLabel')}</span>
                <select
                  value={locale}
                  onChange={(event) => onLocaleChange(event.target.value as 'en' | 'fr')}
                  className="rounded-xl border border-app-border bg-app-bg px-3 py-2 text-app-text outline-none transition focus:border-brand-lime dark:bg-app-elevated"
                >
                  <option value="en">{t('languageSwitcher.english')}</option>
                  <option value="fr">{t('languageSwitcher.french')}</option>
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span>{t('profile.themeModeLabel')}</span>
                <select
                  value={theme}
                  onChange={(event) => onThemeChange(event.target.value as Theme)}
                  className="rounded-xl border border-app-border bg-app-bg px-3 py-2 text-app-text outline-none transition focus:border-brand-lime dark:bg-app-elevated"
                >
                  <option value="light">{t('profile.themeLight')}</option>
                  <option value="dark">{t('profile.themeDark')}</option>
                </select>
              </label>

              <fieldset className="grid gap-2 text-sm">
                <legend>{t('profile.themeAccentLabel')}</legend>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onAccentChange('lime')}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      (settings.themeAccent ?? 'lime') === 'lime'
                        ? 'bg-brand-lime text-brand-dark'
                        : 'border border-app-border bg-app-bg dark:bg-app-elevated'
                    }`}
                  >
                    {t('profile.themeAccentLime')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onAccentChange('pink')}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      (settings.themeAccent ?? 'lime') === 'pink'
                        ? 'bg-brand-pink text-brand-white'
                        : 'border border-app-border bg-app-bg dark:bg-app-elevated'
                    }`}
                  >
                    {t('profile.themeAccentPink')}
                  </button>
                </div>
              </fieldset>

              <Link
                to="/providers"
                className="mt-1 rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm font-semibold transition hover:border-brand-lime dark:bg-app-elevated"
              >
                {t('profile.manageConnections')}
              </Link>
            </div>
          </article>
        </div>

        <article className="rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card">
          <h2 className="text-xl font-bold text-brand-dark dark:text-brand-white">
            {t('profile.securityTitle')}
          </h2>
          <form onSubmit={changePassword} className="mt-4 grid gap-3 sm:max-w-xl">
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder={t('profile.currentPassword')}
              className="rounded-xl border border-app-border bg-app-bg px-3 py-2 text-app-text outline-none transition focus:border-brand-pink dark:bg-app-elevated"
              autoComplete="current-password"
              required
            />
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder={t('profile.newPassword')}
              className="rounded-xl border border-app-border bg-app-bg px-3 py-2 text-app-text outline-none transition focus:border-brand-pink dark:bg-app-elevated"
              autoComplete="new-password"
              required
              minLength={8}
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder={t('profile.confirmPassword')}
              className="rounded-xl border border-app-border bg-app-bg px-3 py-2 text-app-text outline-none transition focus:border-brand-pink dark:bg-app-elevated"
              autoComplete="new-password"
              required
              minLength={8}
            />
            <button
              type="submit"
              disabled={isChangingPassword}
              className="mt-1 rounded-lg bg-brand-dark px-3 py-2 text-sm font-semibold text-brand-white transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand-white dark:text-brand-dark"
            >
              {isChangingPassword ? t('profile.changingPassword') : t('profile.changePassword')}
            </button>
          </form>
          {passwordStatus ? (
            <p
              className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
                passwordStatusType === 'success'
                  ? 'border-brand-lime/35 bg-brand-lime/10 text-[#6d9600] dark:text-[#d5ff5c]'
                  : 'border-brand-pink/35 bg-brand-pink/10 text-[#b41563] dark:text-[#ff8ac0]'
              }`}
            >
              {passwordStatus}
            </p>
          ) : null}
        </article>
      </div>

      <Modal
        open={isAvatarModalOpen}
        title={t('profile.avatarModalTitle')}
        onClose={() => {
          setIsAvatarModalOpen(false);
          setIsAvatarDragActive(false);
          setAvatarModalStatus(null);
        }}
      >
        <div className="grid gap-4">
          <p className="text-sm text-app-text-secondary">{t('profile.avatarModalHint')}</p>
          <button
            type="button"
            onDragOver={(event) => {
              event.preventDefault();
              setIsAvatarDragActive(true);
            }}
            onDragLeave={() => setIsAvatarDragActive(false)}
            onDrop={(event) => {
              void onAvatarDrop(event);
            }}
            onClick={() => {
              if (!isSavingAvatar) {
                avatarInputRef.current?.click();
              }
            }}
            disabled={isSavingAvatar}
            className={`rounded-2xl border-2 border-dashed px-4 py-8 text-center text-sm font-medium transition ${
              isAvatarDragActive
                ? 'border-brand-pink bg-brand-pink/10'
                : 'border-app-border bg-app-bg hover:border-brand-lime dark:bg-app-elevated'
            } ${isSavingAvatar ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <p>{t('profile.avatarDropLabel')}</p>
            <p className="mt-1 text-xs text-app-text-secondary">{t('profile.avatarClickLabel')}</p>
          </button>
          <input
            id="avatar-upload-input"
            type="file"
            accept="image/*"
            className="hidden"
            ref={avatarInputRef}
            onChange={onAvatarUpload}
          />
          {avatarSrc ? (
            <button
              type="button"
              onClick={() => {
                void removeAvatar();
              }}
              disabled={isSavingAvatar}
              className="w-fit rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm font-semibold transition hover:border-brand-pink dark:bg-app-elevated"
            >
              {t('profile.removeAvatar')}
            </button>
          ) : null}
          {avatarModalStatus ? (
            <p className="rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text-secondary dark:bg-app-elevated">
              {avatarModalStatus}
            </p>
          ) : null}
        </div>
      </Modal>
    </section>
  );
};
