import { personalInfoResponseSchema } from '@synqit/shared';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { CircleChevronBackButton } from '../components/ui/CircleChevronBackButton';
import { ctaClassName } from '../components/ui/cta';
import { useAuthSession } from '../hooks/useAuthSession';
import { useI18n } from '../hooks/useI18n';
import { useToast } from '../hooks/useToast';
import { callApi, toApiError } from '../lib/api';

type PersonalInfoDraft = {
  displayName: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  country: string;
};

const toDraft = (value: {
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  birthDate?: string | null;
  country?: string | null;
}): PersonalInfoDraft => ({
  displayName: value.displayName ?? '',
  firstName: value.firstName ?? '',
  lastName: value.lastName ?? '',
  birthDate: value.birthDate ?? '',
  country: value.country ?? '',
});

export const ProfilePersonalInfoPage = () => {
  const { t } = useI18n();
  const { auth } = useAuthSession();
  const { showToast } = useToast();
  const initialDraft = useMemo(() => toDraft({}), []);
  const [draft, setDraft] = useState<PersonalInfoDraft>(initialDraft);
  const [savedDraft, setSavedDraft] = useState<PersonalInfoDraft>(initialDraft);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchPersonalInfo = useCallback(async () => {
    if (!auth) {
      setDraft(initialDraft);
      setSavedDraft(initialDraft);
      return;
    }

    setIsLoading(true);
    try {
      const response = await callApi(
        '/v1/auth/personal-info',
        {
          method: 'GET',
          headers: {
            authorization: `Bearer ${auth.accessToken}`,
          },
        },
        (payload) => personalInfoResponseSchema.parse(payload),
      );
      const nextDraft = toDraft(response.personalInfo);
      setDraft(nextDraft);
      setSavedDraft(nextDraft);
    } catch (error) {
      const apiError = toApiError(error);
      showToast(t('profile.error', { message: apiError.message }), { variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [auth, initialDraft, showToast, t]);

  useEffect(() => {
    void fetchPersonalInfo();
  }, [fetchPersonalInfo]);

  const updateField = (field: keyof PersonalInfoDraft, value: string) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const savePersonalInfo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!auth) {
      showToast(t('profile.notLoggedIn'), { variant: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      const response = await callApi(
        '/v1/auth/personal-info',
        {
          method: 'PUT',
          headers: {
            authorization: `Bearer ${auth.accessToken}`,
          },
          body: JSON.stringify({
            displayName: draft.displayName,
            firstName: draft.firstName,
            lastName: draft.lastName,
            birthDate: draft.birthDate || null,
            country: draft.country,
          }),
        },
        (payload) => personalInfoResponseSchema.parse(payload),
      );

      const nextDraft = toDraft(response.personalInfo);
      setDraft(nextDraft);
      setSavedDraft(nextDraft);
      showToast(t('profile.personalInfoSaved'), { variant: 'success' });
    } catch (error) {
      const apiError = toApiError(error);
      showToast(t('profile.error', { message: apiError.message }), { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const resetDraft = () => {
    setDraft(savedDraft);
  };

  const clearPersonalInfo = async () => {
    if (!auth) {
      showToast(t('profile.notLoggedIn'), { variant: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      const response = await callApi(
        '/v1/auth/personal-info',
        {
          method: 'DELETE',
          headers: {
            authorization: `Bearer ${auth.accessToken}`,
          },
        },
        (payload) => personalInfoResponseSchema.parse(payload),
      );
      const nextDraft = toDraft(response.personalInfo);
      setDraft(nextDraft);
      setSavedDraft(nextDraft);
      showToast(t('profile.personalInfoCleared'), { variant: 'success' });
    } catch (error) {
      const apiError = toApiError(error);
      showToast(t('profile.error', { message: apiError.message }), { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-16 top-8 h-44 w-52 rounded-full bg-brand-lime/25 blur-[95px] sm:h-56 sm:w-64"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-14 top-20 h-52 w-56 rounded-full bg-brand-pink/25 blur-[105px] sm:h-64 sm:w-72"
      />

      <div className="relative grid gap-6">
        <article>
          <div className="flex items-start gap-4 px-5 py-7 sm:px-8 sm:py-9">
            <CircleChevronBackButton to="/profile" label={t('profile.backToProfile')} />
            <div className="grid gap-1">
              <h1 className="text-2xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-5xl">
                {t('profile.personalInfoTitle')}
              </h1>
              <p className="text-sm text-app-text-secondary sm:text-base">
                {t('profile.personalInfoDescription')}
              </p>
            </div>
          </div>
        </article>

        <article className="w-full rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card">
          <form onSubmit={savePersonalInfo} className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span>{t('profile.displayNameLabel')}</span>
              <input
                value={draft.displayName}
                onChange={(event) => updateField('displayName', event.target.value)}
                placeholder={t('profile.displayNamePlaceholder')}
                disabled={isLoading || isSaving}
                className="rounded-xl border border-app-border bg-app-bg px-3 py-2 text-app-text outline-none transition focus:border-brand-lime dark:bg-app-elevated"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span>{t('profile.emailLabel')}</span>
              <input
                value={auth?.userEmail ?? ''}
                readOnly
                className="rounded-xl border border-app-border bg-app-bg px-3 py-2 text-app-text-secondary outline-none dark:bg-app-elevated"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span>{t('profile.firstNameLabel')}</span>
              <input
                value={draft.firstName}
                onChange={(event) => updateField('firstName', event.target.value)}
                placeholder={t('profile.firstNamePlaceholder')}
                disabled={isLoading || isSaving}
                className="rounded-xl border border-app-border bg-app-bg px-3 py-2 text-app-text outline-none transition focus:border-brand-lime dark:bg-app-elevated"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span>{t('profile.lastNameLabel')}</span>
              <input
                value={draft.lastName}
                onChange={(event) => updateField('lastName', event.target.value)}
                placeholder={t('profile.lastNamePlaceholder')}
                disabled={isLoading || isSaving}
                className="rounded-xl border border-app-border bg-app-bg px-3 py-2 text-app-text outline-none transition focus:border-brand-lime dark:bg-app-elevated"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span>{t('profile.birthDateLabel')}</span>
              <input
                type="date"
                value={draft.birthDate}
                onChange={(event) => updateField('birthDate', event.target.value)}
                disabled={isLoading || isSaving}
                className="rounded-xl border border-app-border bg-app-bg px-3 py-2 text-app-text outline-none transition focus:border-brand-lime dark:bg-app-elevated"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span>{t('profile.countryLabel')}</span>
              <input
                value={draft.country}
                onChange={(event) => updateField('country', event.target.value)}
                placeholder={t('profile.countryPlaceholder')}
                disabled={isLoading || isSaving}
                className="rounded-xl border border-app-border bg-app-bg px-3 py-2 text-app-text outline-none transition focus:border-brand-lime dark:bg-app-elevated"
              />
            </label>

            <div className="mt-2 flex flex-wrap justify-end gap-2 sm:col-span-2">
              <button
                type="submit"
                disabled={isLoading || isSaving}
                className={ctaClassName('primary')}
              >
                {t('profile.personalInfoSave')}
              </button>
              <button
                type="button"
                disabled={isLoading || isSaving}
                onClick={resetDraft}
                className={ctaClassName('secondary')}
              >
                {t('profile.personalInfoReset')}
              </button>
              <button
                type="button"
                disabled={isLoading || isSaving}
                onClick={clearPersonalInfo}
                className={ctaClassName('dangerSoft')}
              >
                {t('profile.personalInfoClear')}
              </button>
            </div>
          </form>
        </article>
      </div>
    </section>
  );
};
