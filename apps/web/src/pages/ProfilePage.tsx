import { authUserSchema } from '@synqit/shared';
import { Pencil } from 'lucide-react';
import { ChangeEvent, DragEvent, useRef, useState } from 'react';

import { AppPageLayout } from '../components/app/AppPageLayout';
import { AppSurfaceCard } from '../components/app/AppSurfaceCard';
import { CircularImage } from '../components/ui/CircularImage';
import { CTAButton, CTALink } from '../components/ui/cta';
import { LanguageSwitcher } from '../components/ui/LanguageSwitcher';
import { Modal } from '../components/ui/Modal';
import { NotificationDot } from '../components/ui/NotificationDot';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { useAuthSession } from '../hooks/useAuthSession';
import { useI18n } from '../hooks/useI18n';
import { useProfileCompletion } from '../hooks/useProfileCompletion';
import { useProfileSettings } from '../hooks/useProfileSettings';
import { useToast } from '../hooks/useToast';
import { callApi, toApiError } from '../lib/api';
import { updateStoredAuthUser } from '../lib/auth';

const MAX_AVATAR_BYTES = 8_000_000;

export const ProfilePage = () => {
  const { t } = useI18n();
  const { auth, setAuth } = useAuthSession();
  const { settings, updateSettings } = useProfileSettings();
  const { showToast } = useToast();
  const { showPersonalInfoPrompt } = useProfileCompletion(auth);

  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isAvatarDragActive, setIsAvatarDragActive] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const avatarSrc = auth?.avatarUrl ?? settings.avatarDataUrl ?? null;

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

    if (!file.type.startsWith('image/')) {
      showToast(t('profile.avatarInvalidType'), { variant: 'error' });
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      showToast(t('profile.avatarTooLarge'), { variant: 'error' });
      return;
    }

    if (!auth) {
      showToast(t('profile.notLoggedIn'), { variant: 'error' });
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

      showToast(t('profile.avatarSaved'), { variant: 'success' });
      setIsAvatarModalOpen(false);
    } catch (error) {
      const apiError = toApiError(error);
      const message =
        apiError.code === 'invalid_avatar_image'
          ? t('profile.avatarInvalidType')
          : t('profile.error', { message: apiError.message });
      showToast(message, { variant: 'error' });
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const onAvatarUpload = (event: ChangeEvent<HTMLInputElement>) => {
    void handleAvatarFile(event.target.files?.[0]);
  };

  const removeAvatar = async () => {
    if (!auth) {
      showToast(t('profile.notLoggedIn'), { variant: 'error' });
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

      showToast(t('profile.avatarRemoved'), { variant: 'success' });
    } catch (error) {
      const apiError = toApiError(error);
      showToast(t('profile.error', { message: apiError.message }), { variant: 'error' });
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const onAvatarDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsAvatarDragActive(false);

    void handleAvatarFile(event.dataTransfer.files?.[0]);
  };

  return (
    <AppPageLayout>
      <article>
        <div className="grid grid-cols-[minmax(0,14rem)_auto] items-start gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-6 sm:pb-8 sm:px-2">
          <div className="grid gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-app-text-secondary">
              {t('profile.pill')}
            </p>
            <h1 className="text-2xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-5xl">
              {t('profile.pageTitle')}
            </h1>
            <p className="text-sm text-app-text-secondary sm:text-base">
              {t('profile.pageDescription')}
            </p>
            <p className="text-sm text-app-text-secondary">
              {auth ? auth.userEmail : t('profile.notLoggedIn')}
            </p>
          </div>

          <div className="relative">
            <div className="h-24 w-24 rounded-full bg-brand-gradient p-0.5 sm:h-28 sm:w-28 lg:h-32 lg:w-32">
              <div className="h-full w-full overflow-hidden rounded-full bg-app-bg">
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
              aria-label={t('profile.editAvatar')}
              className="absolute -bottom-2 left-1/2 inline-flex -translate-x-1/2 cursor-pointer items-center justify-center rounded-full border border-app-border bg-app-elevated p-1.5 text-xs font-semibold shadow-soft-lift transition hover:border-brand-pink dark:bg-app-card sm:gap-1.5 sm:px-3 sm:py-1"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{t('profile.editAvatar')}</span>
            </button>
          </div>
        </div>
      </article>

      <AppSurfaceCard>
        <div className="grid gap-1">
          <h2 className="text-xl font-bold text-brand-dark dark:text-brand-white">
            {t('profile.preferencesTitle')}
          </h2>
          <p className="text-sm text-app-text-secondary">{t('profile.preferencesDescription')}</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-0">
          <div className="grid gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-app-text-secondary">
              {t('profile.preferencesThemeLabel')}
            </p>
            <div className="flex items-center">
              <ThemeToggle />
            </div>
          </div>

          <div className="grid gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-app-text-secondary">
              {t('profile.preferencesLanguageLabel')}
            </p>
            <div className="flex items-center">
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </AppSurfaceCard>

      <div className="grid gap-5 lg:grid-cols-3">
        <AppSurfaceCard
          className={`flex flex-col ${showPersonalInfoPrompt ? 'border-brand-pink/45 bg-brand-pink/5 dark:bg-brand-pink/10' : ''}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="grid gap-2">
              <h2 className="text-xl font-bold text-brand-dark dark:text-brand-white">
                {t('profile.personalInfoCardTitle')}
              </h2>
              <p className="text-sm text-app-text-secondary">
                {t(
                  showPersonalInfoPrompt
                    ? 'profile.personalInfoCardBodyIncomplete'
                    : 'profile.personalInfoCardBody',
                )}
              </p>
            </div>
            {showPersonalInfoPrompt ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-pink/40 bg-brand-pink/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#b41563] dark:text-[#ff8ac0]">
                <NotificationDot className="h-2.5 w-2.5 ring-0" />
                {t('profile.personalInfoIncompleteBadge')}
              </span>
            ) : null}
          </div>
          <CTALink to="/profile/personal-info" variant="secondary" className="mt-auto self-end">
            {showPersonalInfoPrompt ? <NotificationDot className="h-2.5 w-2.5 ring-0" /> : null}
            {t(
              showPersonalInfoPrompt
                ? 'profile.personalInfoCardCtaIncomplete'
                : 'profile.personalInfoCardCta',
            )}
          </CTALink>
        </AppSurfaceCard>

        <AppSurfaceCard className="flex flex-col">
          <h2 className="text-xl font-bold text-brand-dark dark:text-brand-white">
            {t('profile.platformsCardTitle')}
          </h2>
          <p className="mt-2 text-sm text-app-text-secondary">{t('profile.platformsCardBody')}</p>
          <div className="mt-4 flex items-center gap-2">
            <CircularImage src="/assets/logos/Providers/Spotify.png" alt="Spotify" />
            <CircularImage src="/assets/logos/Providers/AppleMusic.png" alt="Apple Music" />
          </div>
          <CTALink to="/profile/platforms" variant="secondary" className="mt-auto self-end">
            {t('profile.platformsCardCta')}
          </CTALink>
        </AppSurfaceCard>

        <AppSurfaceCard className="flex flex-col">
          <h2 className="text-xl font-bold text-brand-dark dark:text-brand-white">
            {t('profile.securityCardTitle')}
          </h2>
          <p className="mt-2 text-sm text-app-text-secondary">{t('profile.securityCardBody')}</p>
          <CTALink to="/profile/security" variant="secondary" className="mt-auto self-end">
            {t('profile.securityCardCta')}
          </CTALink>
        </AppSurfaceCard>
      </div>

      <Modal
        open={isAvatarModalOpen}
        title={t('profile.avatarModalTitle')}
        onClose={() => {
          setIsAvatarModalOpen(false);
          setIsAvatarDragActive(false);
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
            <CTAButton
              type="button"
              onClick={() => {
                void removeAvatar();
              }}
              disabled={isSavingAvatar}
              variant="dangerSoft"
              className="w-full sm:w-fit"
            >
              {t('profile.removeAvatar')}
            </CTAButton>
          ) : null}
        </div>
      </Modal>
    </AppPageLayout>
  );
};
