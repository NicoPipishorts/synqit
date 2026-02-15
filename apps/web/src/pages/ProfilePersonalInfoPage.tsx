import { FormEvent, useEffect, useMemo, useState } from 'react';

import { CircleChevronBackButton } from '../components/ui/CircleChevronBackButton';
import { ctaClassName } from '../components/ui/cta';
import { useAuthSession } from '../hooks/useAuthSession';
import { useI18n } from '../hooks/useI18n';
import { useProfileSettings } from '../hooks/useProfileSettings';
import { useToast } from '../hooks/useToast';

type PersonalInfoDraft = {
  displayName: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  country: string;
};

const toDraft = (value: {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  country?: string;
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
  const { settings, updateSettings } = useProfileSettings();
  const { showToast } = useToast();
  const initialDraft = useMemo(() => toDraft(settings.personalInfo ?? {}), [settings.personalInfo]);
  const [draft, setDraft] = useState<PersonalInfoDraft>(initialDraft);

  useEffect(() => {
    setDraft(initialDraft);
  }, [initialDraft]);

  const updateField = (field: keyof PersonalInfoDraft, value: string) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const savePersonalInfo = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateSettings({
      personalInfo: {
        displayName: draft.displayName,
        firstName: draft.firstName,
        lastName: draft.lastName,
        birthDate: draft.birthDate,
        country: draft.country,
      },
    });
    showToast(t('profile.personalInfoSaved'), { variant: 'success' });
  };

  const resetDraft = () => {
    setDraft(toDraft(settings.personalInfo ?? {}));
  };

  const clearPersonalInfo = () => {
    updateSettings({
      personalInfo: undefined,
    });
    setDraft(toDraft({}));
    showToast(t('profile.personalInfoCleared'), { variant: 'success' });
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

        <article className="rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card">
          <form onSubmit={savePersonalInfo} className="grid gap-4 sm:max-w-3xl sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span>{t('profile.displayNameLabel')}</span>
              <input
                value={draft.displayName}
                onChange={(event) => updateField('displayName', event.target.value)}
                placeholder={t('profile.displayNamePlaceholder')}
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
                className="rounded-xl border border-app-border bg-app-bg px-3 py-2 text-app-text outline-none transition focus:border-brand-lime dark:bg-app-elevated"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span>{t('profile.lastNameLabel')}</span>
              <input
                value={draft.lastName}
                onChange={(event) => updateField('lastName', event.target.value)}
                placeholder={t('profile.lastNamePlaceholder')}
                className="rounded-xl border border-app-border bg-app-bg px-3 py-2 text-app-text outline-none transition focus:border-brand-lime dark:bg-app-elevated"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span>{t('profile.birthDateLabel')}</span>
              <input
                type="date"
                value={draft.birthDate}
                onChange={(event) => updateField('birthDate', event.target.value)}
                className="rounded-xl border border-app-border bg-app-bg px-3 py-2 text-app-text outline-none transition focus:border-brand-lime dark:bg-app-elevated"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span>{t('profile.countryLabel')}</span>
              <input
                value={draft.country}
                onChange={(event) => updateField('country', event.target.value)}
                placeholder={t('profile.countryPlaceholder')}
                className="rounded-xl border border-app-border bg-app-bg px-3 py-2 text-app-text outline-none transition focus:border-brand-lime dark:bg-app-elevated"
              />
            </label>

            <div className="mt-2 flex flex-wrap justify-end gap-2 sm:col-span-2">
              <button type="submit" className={ctaClassName('primary')}>
                {t('profile.personalInfoSave')}
              </button>
              <button type="button" onClick={resetDraft} className={ctaClassName('secondary')}>
                {t('profile.personalInfoReset')}
              </button>
              <button
                type="button"
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
