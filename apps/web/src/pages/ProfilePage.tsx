import { authUserSchema } from '@synqit/shared';
import { Pencil } from 'lucide-react';
import { ChangeEvent, DragEvent, useRef, useState } from 'react';

import { CTAButton, CTALink } from '../components/ui/cta';
import { Modal } from '../components/ui/Modal';
import { useAuthSession } from '../hooks/useAuthSession';
import { useI18n } from '../hooks/useI18n';
import { useProfileSettings } from '../hooks/useProfileSettings';
import { useToast } from '../hooks/useToast';
import { callApi, toApiError } from '../lib/api';
import { updateStoredAuthUser } from '../lib/auth';

const MAX_AVATAR_BYTES = 1_500_000;

export const ProfilePage = () => {
  const { t } = useI18n();
  const { auth, setAuth } = useAuthSession();
  const { settings, updateSettings } = useProfileSettings();
  const { showToast } = useToast();

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
    <section className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-16 top-8 h-44 w-52 rounded-full bg-brand-lime/30 blur-[95px] sm:h-56 sm:w-64"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-14 top-20 h-52 w-56 rounded-full bg-brand-pink/30 blur-[105px] sm:h-64 sm:w-72"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-10 top-[34%] hidden h-40 w-40 rounded-full bg-brand-pink/20 blur-[90px] md:block"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-8 top-[48%] hidden h-52 w-44 rounded-full bg-brand-lime/20 blur-[95px] lg:block"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-8 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full bg-brand-gradient opacity-25 blur-[110px] sm:h-48 sm:w-[22rem]"
      />

      <div className="relative grid gap-6">
        <article>
          <div className="flex flex-wrap items-start justify-between gap-6 px-5 py-7 sm:px-8 sm:py-9">
            <div className="grid gap-2">
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

        <div className="grid gap-5 lg:grid-cols-3">
          <article className="flex flex-col rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card">
            <h2 className="text-xl font-bold text-brand-dark dark:text-brand-white">
              {t('profile.platformsCardTitle')}
            </h2>
            <p className="mt-2 text-sm text-app-text-secondary">{t('profile.platformsCardBody')}</p>
            <div className="mt-4 flex items-center gap-2">
              <img
                src="/assets/logos/Providers/Spotify.png"
                alt="Spotify"
                className="h-8 w-8 rounded-full object-cover"
              />
              <img
                src="/assets/logos/Providers/AppleMusic.png"
                alt="Apple Music"
                className="h-8 w-8 rounded-full object-cover"
              />
            </div>
            <CTALink to="/profile/platforms" variant="secondary" className="mt-auto self-end">
              {t('profile.platformsCardCta')}
            </CTALink>
          </article>

          <article className="flex flex-col rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card">
            <h2 className="text-xl font-bold text-brand-dark dark:text-brand-white">
              {t('profile.personalInfoCardTitle')}
            </h2>
            <p className="mt-2 text-sm text-app-text-secondary">
              {t('profile.personalInfoCardBody')}
            </p>
            <CTALink to="/profile/personal-info" variant="secondary" className="mt-auto self-end">
              {t('profile.personalInfoCardCta')}
            </CTALink>
          </article>

          <article className="flex flex-col rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card">
            <h2 className="text-xl font-bold text-brand-dark dark:text-brand-white">
              {t('profile.securityCardTitle')}
            </h2>
            <p className="mt-2 text-sm text-app-text-secondary">{t('profile.securityCardBody')}</p>
            <CTALink to="/profile/security" variant="secondary" className="mt-auto self-end">
              {t('profile.securityCardCta')}
            </CTALink>
          </article>
        </div>
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
              className="w-fit"
            >
              {t('profile.removeAvatar')}
            </CTAButton>
          ) : null}
        </div>
      </Modal>
    </section>
  );
};
