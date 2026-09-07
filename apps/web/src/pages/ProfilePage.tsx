import { authUserSchema } from '@synqit/shared';
import {
  CircularImage,
  NotificationDot,
  OnboardingPanel,
  Sticker,
  SurfaceCard,
  useToast,
} from '@synqit/ui';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Check, ImagePlus, Pencil, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { ChangeEvent, DragEvent, useRef, useState } from 'react';

import { AppPageLayout } from '../components/app/AppPageLayout';
import { CTAButton, CTALink } from '../components/ui/cta';
import { LanguageSwitcher } from '../components/ui/LanguageSwitcher';
import { Modal } from '../components/ui/Modal';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { useAuthSession } from '../hooks/useAuthSession';
import { useI18n } from '../hooks/useI18n';
import { useProfileCompletion } from '../hooks/useProfileCompletion';
import { useProfileSettings } from '../hooks/useProfileSettings';
import { callApi, toApiError } from '../lib/api';
import { updateStoredAuthUser } from '../lib/auth';
import { fetchIntegrations, queryKeys } from '../lib/queries';

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
  const integrationsQuery = useQuery({
    queryKey: queryKeys.integrations.list(),
    queryFn: fetchIntegrations,
    enabled: Boolean(auth),
    staleTime: 60_000,
  });
  const hasConnectedPlatform = Object.values(integrationsQuery.data ?? {}).some(
    (status) => status === 'connected',
  );
  const profileTasks = [
    {
      id: 'avatar',
      label: t('profile.taskAvatar'),
      done: Boolean(avatarSrc),
      icon: <ImagePlus size={16} aria-hidden="true" />,
      action: 'avatar' as const,
    },
    {
      id: 'identity',
      label: t('profile.taskIdentity'),
      done: !showPersonalInfoPrompt,
      icon: <UserRound size={16} aria-hidden="true" />,
      action: '/profile/personal-info' as const,
    },
    {
      id: 'platforms',
      label: t('profile.taskPlatforms'),
      done: hasConnectedPlatform,
      icon: <ShieldCheck size={16} aria-hidden="true" />,
      action: '/profile/platforms' as const,
    },
  ];
  const doneTaskCount = profileTasks.filter((task) => task.done).length;
  const isProfileComplete = doneTaskCount === profileTasks.length;

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
            <Sticker tone="paper" tilt="-rotate-2" className="mb-1">
              {t('profile.pill')}
            </Sticker>
            <h1 className="text-3xl font-black leading-[1.02] tracking-tight text-brand-dark dark:text-brand-white sm:text-5xl">
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
            <div className="h-24 w-24 rounded-full border-[3px] border-app-text bg-app-elevated p-1 shadow-sticker dark:bg-app-card sm:h-28 sm:w-28 lg:h-32 lg:w-32">
              <div className="h-full w-full overflow-hidden rounded-full bg-brand-lime">
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt={t('profile.avatarAlt')}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center text-brand-dark"
                    role="img"
                    aria-label={t('profile.noAvatar')}
                  >
                    <UserRound
                      className="h-10 w-10 sm:h-12 sm:w-12"
                      strokeWidth={2.25}
                      aria-hidden="true"
                    />
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsAvatarModalOpen(true)}
              aria-label={t('profile.editAvatar')}
              className="absolute -bottom-2 left-1/2 inline-flex -translate-x-1/2 cursor-pointer items-center justify-center rounded-full border-2 border-app-text bg-app-elevated p-1.5 text-xs font-black shadow-sticker-sm transition hover:bg-brand-lime hover:text-brand-dark dark:bg-app-card sm:gap-1.5 sm:px-3 sm:py-1"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{t('profile.editAvatar')}</span>
            </button>
          </div>
        </div>
      </article>

      {isProfileComplete ? (
        <OnboardingPanel
          eyebrow={t('profile.readyEyebrow')}
          title={t('profile.readyTitle')}
          body={t('profile.readyBody')}
          icon={<Sparkles size={24} aria-hidden="true" />}
          actions={
            <>
              <CTALink
                to="/profile/personal-info"
                variant="primary"
                size="lg"
                className="justify-center"
              >
                {t('profile.readyCtaPreferences')}
              </CTALink>
              <CTALink
                to="/profile/security"
                variant="secondary"
                size="lg"
                className="justify-center"
              >
                {t('profile.readyCtaPassword')}
              </CTALink>
              <CTALink
                to="/profile/platforms"
                variant="secondary"
                size="lg"
                className="justify-center"
              >
                {t('profile.readyCtaConnections')}
              </CTALink>
            </>
          }
        />
      ) : (
        <OnboardingPanel
          eyebrow={t('profile.onboardingEyebrow')}
          title={t('profile.onboardingTitle')}
          body={t('profile.onboardingBody')}
          icon={<UserRound size={24} aria-hidden="true" />}
          note={t('profile.onboardingNote')}
          actions={
            <div className="grid w-full gap-3">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-app-text-secondary">
                {t('profile.taskProgress', { done: doneTaskCount, total: profileTasks.length })}
              </p>
              <ul className="grid gap-2">
                {profileTasks.map((task, index) => {
                  const isNextTodo = !task.done && profileTasks.findIndex((x) => !x.done) === index;
                  return (
                    <li
                      key={task.id}
                      className={`flex items-center gap-3 rounded-2xl border-2 px-3 py-2.5 transition ${
                        task.done
                          ? 'border-app-text/30 bg-brand-lime/10'
                          : 'border-app-text bg-app-elevated shadow-sticker-sm dark:bg-app-card'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                          task.done
                            ? 'border-app-text bg-brand-lime text-brand-dark'
                            : 'border-dashed border-app-text/50 text-app-text-secondary'
                        }`}
                      >
                        {task.done ? <Check size={16} strokeWidth={3} /> : task.icon}
                      </span>
                      <span
                        className={`min-w-0 flex-1 text-sm font-black ${
                          task.done
                            ? 'text-app-text-secondary line-through decoration-2'
                            : 'text-brand-dark dark:text-brand-white'
                        }`}
                      >
                        {task.label}
                      </span>
                      {task.done ? (
                        <>
                          <Sticker tone="lime" tilt="-rotate-2" className="px-2 py-0 text-[10px]">
                            {t('profile.taskDone')}
                          </Sticker>
                          {task.action === 'avatar' ? (
                            <button
                              type="button"
                              onClick={() => setIsAvatarModalOpen(true)}
                              className="text-xs font-bold text-app-text-secondary underline decoration-2 underline-offset-2 hover:text-app-text"
                            >
                              {t('profile.taskEdit')}
                            </button>
                          ) : (
                            <Link
                              to={task.action}
                              className="text-xs font-bold text-app-text-secondary underline decoration-2 underline-offset-2 hover:text-app-text"
                            >
                              {t('profile.taskEdit')}
                            </Link>
                          )}
                        </>
                      ) : task.action === 'avatar' ? (
                        <CTAButton
                          type="button"
                          variant={isNextTodo ? 'primary' : 'secondary'}
                          onClick={() => setIsAvatarModalOpen(true)}
                        >
                          {t('profile.onboardingCtaAvatar')}
                        </CTAButton>
                      ) : (
                        <CTALink to={task.action} variant={isNextTodo ? 'primary' : 'secondary'}>
                          {task.action === '/profile/platforms'
                            ? t('profile.onboardingCtaPlatforms')
                            : t('profile.onboardingCtaProfile')}
                        </CTALink>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          }
        />
      )}

      <SurfaceCard>
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
      </SurfaceCard>

      <div className="grid gap-5 lg:grid-cols-3">
        <SurfaceCard
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
        </SurfaceCard>

        <SurfaceCard className="flex flex-col">
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
        </SurfaceCard>

        <SurfaceCard className="flex flex-col">
          <h2 className="text-xl font-bold text-brand-dark dark:text-brand-white">
            {t('profile.securityCardTitle')}
          </h2>
          <p className="mt-2 text-sm text-app-text-secondary">{t('profile.securityCardBody')}</p>
          <CTALink to="/profile/security" variant="secondary" className="mt-auto self-end">
            {t('profile.securityCardCta')}
          </CTALink>
        </SurfaceCard>
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
            className={`rounded-2xl border-2 border-dashed px-4 py-8 text-center text-sm font-bold transition ${
              isAvatarDragActive
                ? 'border-app-text bg-brand-lime/25 shadow-sticker-sm'
                : 'border-app-text/60 bg-app-surface hover:border-app-text hover:bg-brand-lime/10 dark:bg-app-elevated'
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
