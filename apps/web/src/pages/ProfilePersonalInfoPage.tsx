import { personalInfoResponseSchema } from '@synqit/shared';
import countries from 'i18n-iso-countries';
import enCountryNames from 'i18n-iso-countries/langs/en.json';
import frCountryNames from 'i18n-iso-countries/langs/fr.json';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { CircleChevronBackButton } from '../components/ui/CircleChevronBackButton';
import { CTAButton, CTALink } from '../components/ui/cta';
import { useAuthSession } from '../hooks/useAuthSession';
import { useI18n } from '../hooks/useI18n';
import { useToast } from '../hooks/useToast';
import { callApi, toApiError } from '../lib/api';

countries.registerLocale(enCountryNames);
countries.registerLocale(frCountryNames);

const birthDatePattern = /^\d{4}-\d{2}-\d{2}$/;

type PersonalInfoDraft = {
  displayName: string;
  firstName: string;
  lastName: string;
  birthDay: string;
  birthMonth: string;
  birthYear: string;
  country: string;
};

type BirthDateParts = Pick<PersonalInfoDraft, 'birthDay' | 'birthMonth' | 'birthYear'>;

const toBirthDateParts = (birthDate?: string | null): BirthDateParts => {
  if (!birthDate || !birthDatePattern.test(birthDate)) {
    return {
      birthDay: '',
      birthMonth: '',
      birthYear: '',
    };
  }

  const [birthYear, birthMonth, birthDay] = birthDate.split('-');
  return {
    birthDay,
    birthMonth,
    birthYear,
  };
};

const buildBirthDate = (parts: BirthDateParts): { birthDate: string | null; isValid: boolean } => {
  const dayRaw = parts.birthDay.trim();
  const monthRaw = parts.birthMonth.trim();
  const yearRaw = parts.birthYear.trim();
  const allEmpty = !dayRaw && !monthRaw && !yearRaw;

  if (allEmpty) {
    return { birthDate: null, isValid: true };
  }

  if (!dayRaw || !monthRaw || !yearRaw) {
    return { birthDate: null, isValid: false };
  }

  const day = Number(dayRaw);
  const month = Number(monthRaw);
  const year = Number(yearRaw);
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return { birthDate: null, isValid: false };
  }
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return { birthDate: null, isValid: false };
  }

  const normalized = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    normalized.getUTCFullYear() === year &&
    normalized.getUTCMonth() + 1 === month &&
    normalized.getUTCDate() === day;
  if (!isRealDate) {
    return { birthDate: null, isValid: false };
  }

  return {
    birthDate: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    isValid: true,
  };
};

const toDraft = (value: {
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  birthDate?: string | null;
  country?: string | null;
}): PersonalInfoDraft => {
  const birthDateParts = toBirthDateParts(value.birthDate);

  return {
    displayName: value.displayName ?? '',
    firstName: value.firstName ?? '',
    lastName: value.lastName ?? '',
    ...birthDateParts,
    country: value.country ?? '',
  };
};

export const ProfilePersonalInfoPage = () => {
  const { t, locale } = useI18n();
  const { auth } = useAuthSession();
  const { showToast } = useToast();
  const initialDraft = useMemo(() => toDraft({}), []);
  const [draft, setDraft] = useState<PersonalInfoDraft>(initialDraft);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCountryMenuOpen, setIsCountryMenuOpen] = useState(false);

  const fetchPersonalInfo = useCallback(async () => {
    if (!auth) {
      setDraft(initialDraft);
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

  const monthOptions = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, { month: 'long' });
    return Array.from({ length: 12 }, (_, index) => {
      const monthDate = new Date(Date.UTC(2000, index, 1));
      const value = String(index + 1).padStart(2, '0');
      const label = formatter.format(monthDate);

      return {
        value,
        label: label.slice(0, 1).toUpperCase() + label.slice(1),
      };
    });
  }, [locale]);

  const countryOptions = useMemo(() => {
    const countryLocale = locale === 'fr' ? 'fr' : 'en';
    const names = countries.getNames(countryLocale, { select: 'official' });
    return Object.values(names).sort((left, right) => left.localeCompare(right, locale));
  }, [locale]);

  const filteredCountryOptions = useMemo(() => {
    const query = draft.country.trim().toLocaleLowerCase(locale);
    const filtered = query
      ? countryOptions.filter((countryName) =>
          countryName.toLocaleLowerCase(locale).includes(query),
        )
      : countryOptions;
    return filtered.slice(0, 12);
  }, [countryOptions, draft.country, locale]);

  const savePersonalInfo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!auth) {
      showToast(t('profile.notLoggedIn'), { variant: 'error' });
      return;
    }

    const birthDateResult = buildBirthDate({
      birthDay: draft.birthDay,
      birthMonth: draft.birthMonth,
      birthYear: draft.birthYear,
    });
    if (!birthDateResult.isValid) {
      showToast(t('profile.birthDateInvalid'), { variant: 'error' });
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
            birthDate: birthDateResult.birthDate,
            country: draft.country,
          }),
        },
        (payload) => personalInfoResponseSchema.parse(payload),
      );

      const nextDraft = toDraft(response.personalInfo);
      setDraft(nextDraft);
      showToast(t('profile.personalInfoSaved'), { variant: 'success' });
    } catch (error) {
      const apiError = toApiError(error);
      showToast(t('profile.error', { message: apiError.message }), { variant: 'error' });
    } finally {
      setIsSaving(false);
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
            <label className="grid gap-1 text-sm md:col-span-2">
              <span>{t('profile.birthDateLabel')}</span>
              <div className="grid grid-cols-3 gap-2">
                <input
                  inputMode="numeric"
                  value={draft.birthDay}
                  onChange={(event) =>
                    updateField('birthDay', event.target.value.replace(/\D/g, '').slice(0, 2))
                  }
                  placeholder={t('profile.birthDayPlaceholder')}
                  disabled={isLoading || isSaving}
                  className="rounded-xl border border-app-border bg-app-bg px-3 py-2 text-app-text outline-none transition focus:border-brand-lime dark:bg-app-elevated"
                />
                <select
                  value={draft.birthMonth}
                  onChange={(event) => updateField('birthMonth', event.target.value)}
                  disabled={isLoading || isSaving}
                  className="rounded-xl border border-app-border bg-app-bg px-3 py-2 text-app-text outline-none transition focus:border-brand-lime dark:bg-app-elevated"
                >
                  <option value="">{t('profile.birthMonthPlaceholder')}</option>
                  {monthOptions.map((monthOption) => (
                    <option key={monthOption.value} value={monthOption.value}>
                      {monthOption.label}
                    </option>
                  ))}
                </select>
                <input
                  inputMode="numeric"
                  value={draft.birthYear}
                  onChange={(event) =>
                    updateField('birthYear', event.target.value.replace(/\D/g, '').slice(0, 4))
                  }
                  placeholder={t('profile.birthYearPlaceholder')}
                  disabled={isLoading || isSaving}
                  className="rounded-xl border border-app-border bg-app-bg px-3 py-2 text-app-text outline-none transition focus:border-brand-lime dark:bg-app-elevated"
                />
              </div>
            </label>
            <label className="grid gap-1 text-sm">
              <span>{t('profile.countryLabel')}</span>
              <div className="relative">
                <input
                  value={draft.country}
                  onChange={(event) => {
                    updateField('country', event.target.value);
                    setIsCountryMenuOpen(true);
                  }}
                  onFocus={() => setIsCountryMenuOpen(true)}
                  onBlur={() => {
                    window.setTimeout(() => {
                      setIsCountryMenuOpen(false);
                    }, 120);
                  }}
                  placeholder={t('profile.countryPlaceholder')}
                  disabled={isLoading || isSaving}
                  className="w-full rounded-xl border border-app-border bg-app-bg px-3 py-2 text-app-text outline-none transition focus:border-brand-lime dark:bg-app-elevated"
                />
                {isCountryMenuOpen ? (
                  <div className="absolute z-[120] mt-1 max-h-32 w-full overflow-auto rounded-xl border border-app-border bg-app-elevated p-0.5 shadow-soft-lift dark:bg-app-card">
                    {filteredCountryOptions.length > 0 ? (
                      filteredCountryOptions.map((countryName) => (
                        <button
                          key={countryName}
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            updateField('country', countryName);
                            setIsCountryMenuOpen(false);
                          }}
                          className="flex w-full cursor-pointer items-center rounded-md px-2 py-1 text-left text-xs text-app-text transition hover:bg-brand-lime/20"
                        >
                          {countryName}
                        </button>
                      ))
                    ) : (
                      <div className="px-2 py-1 text-xs text-app-text-secondary">
                        {t('profile.countryNoResult')}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </label>

            <div className="mt-2 flex flex-wrap justify-end gap-2 sm:col-span-2">
              <CTAButton type="submit" disabled={isLoading || isSaving} variant="primary">
                {t('profile.personalInfoSave')}
              </CTAButton>
              <CTALink to="/profile" variant="secondary">
                {t('profile.personalInfoCancel')}
              </CTALink>
            </div>
          </form>
        </article>
      </div>
    </section>
  );
};
