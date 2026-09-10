import type { AdminAnalyticsOverviewRange } from '@synqit/shared';
import { SlideOverPanel } from '@synqit/ui';
import { type ReactNode } from 'react';

import { useI18n } from '../../hooks/useI18n';
import { CTAButton } from '../ui/cta';

export type AnalyticsFilters = {
  range: AdminAnalyticsOverviewRange;
  source: 'web' | 'site' | null;
  target: string | null;
  page: string | null;
  locale: 'en' | 'fr' | 'es' | null;
  visitor: 'anonymous' | 'authenticated' | null;
};

export const EMPTY_FILTERS: Omit<AnalyticsFilters, 'range'> = {
  source: null,
  target: null,
  page: null,
  locale: null,
  visitor: null,
};

// Number of non-range filters currently active — drives the button badge.
export const activeFilterCount = (filters: AnalyticsFilters): number =>
  [filters.source, filters.target, filters.page, filters.locale, filters.visitor].filter(Boolean)
    .length;

type Option<T extends string> = { value: T | null; label: string };

type AnalyticsFilterDrawerProps = {
  open: boolean;
  onClose: () => void;
  draft: AnalyticsFilters;
  onDraftChange: (next: AnalyticsFilters) => void;
  rangeOptions: { value: AdminAnalyticsOverviewRange; label: string }[];
  featureOptions: { value: string; label: string }[];
  pageOptions: string[];
  onApply: () => void;
  onClear: () => void;
};

const FilterSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="grid gap-2 border-b border-app-border py-4 first:pt-0 last:border-b-0">
    <p className="text-xs font-black uppercase tracking-wide text-app-text-secondary">{title}</p>
    {children}
  </div>
);

const Segmented = <T extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T | null;
  onChange: (next: T | null) => void;
}) => (
  <div className="flex flex-wrap gap-2">
    {options.map((option) => {
      const isActive = value === option.value;
      return (
        <button
          key={option.value ?? '__all__'}
          type="button"
          onClick={() => onChange(option.value)}
          className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-black transition ${
            isActive
              ? 'border-brand-lime bg-brand-lime text-brand-dark'
              : 'border-app-border bg-app-bg text-app-text-secondary hover:border-app-border-strong hover:text-app-text'
          }`}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

const selectClassName =
  'w-full rounded-xl border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text outline-none transition focus:border-brand-lime';

export const AnalyticsFilterDrawer = ({
  open,
  onClose,
  draft,
  onDraftChange,
  rangeOptions,
  featureOptions,
  pageOptions,
  onApply,
  onClear,
}: AnalyticsFilterDrawerProps) => {
  const { t } = useI18n();
  const set = (patch: Partial<AnalyticsFilters>) => onDraftChange({ ...draft, ...patch });

  return (
    <SlideOverPanel
      open={open}
      onClose={onClose}
      title={t('admin.analyticsFiltersTitle')}
      closeLabel={t('admin.analyticsDetailClose')}
    >
      <div className="flex h-full flex-col">
        <div className="grid content-start gap-1">
          <div className="rounded-xl border border-dashed border-app-border bg-app-surface p-3 text-xs font-semibold text-app-text-secondary">
            {t('admin.analyticsFiltersTemplatesSoon')}
          </div>

          <FilterSection title={t('admin.analyticsFiltersRange')}>
            <select
              value={draft.range}
              onChange={(event) =>
                set({ range: event.target.value as AdminAnalyticsOverviewRange })
              }
              className={selectClassName}
            >
              {rangeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FilterSection>

          <FilterSection title={t('admin.analyticsFiltersApp')}>
            <Segmented<'web' | 'site'>
              value={draft.source}
              onChange={(next) => set({ source: next })}
              options={[
                { value: null, label: t('admin.analyticsFiltersAll') },
                { value: 'site', label: t('admin.analyticsFiltersAppSite') },
                { value: 'web', label: t('admin.analyticsFiltersAppWeb') },
              ]}
            />
          </FilterSection>

          <FilterSection title={t('admin.analyticsFiltersFeature')}>
            <select
              value={draft.target ?? ''}
              onChange={(event) => set({ target: event.target.value || null })}
              className={selectClassName}
            >
              <option value="">{t('admin.analyticsFiltersAll')}</option>
              {featureOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FilterSection>

          <FilterSection title={t('admin.analyticsFiltersPage')}>
            <select
              value={draft.page ?? ''}
              onChange={(event) => set({ page: event.target.value || null })}
              className={selectClassName}
              disabled={pageOptions.length === 0}
            >
              <option value="">{t('admin.analyticsFiltersAll')}</option>
              {pageOptions.map((path) => (
                <option key={path} value={path}>
                  {path}
                </option>
              ))}
            </select>
          </FilterSection>

          <FilterSection title={t('admin.analyticsFiltersLanguage')}>
            <Segmented<'en' | 'fr' | 'es'>
              value={draft.locale}
              onChange={(next) => set({ locale: next })}
              options={[
                { value: null, label: t('admin.analyticsFiltersAll') },
                { value: 'en', label: 'EN' },
                { value: 'fr', label: 'FR' },
                { value: 'es', label: 'ES' },
              ]}
            />
          </FilterSection>

          <FilterSection title={t('admin.analyticsFiltersVisitor')}>
            <Segmented<'anonymous' | 'authenticated'>
              value={draft.visitor}
              onChange={(next) => set({ visitor: next })}
              options={[
                { value: null, label: t('admin.analyticsFiltersAll') },
                { value: 'anonymous', label: t('admin.analyticsFiltersVisitorAnon') },
                { value: 'authenticated', label: t('admin.analyticsFiltersVisitorAuth') },
              ]}
            />
          </FilterSection>
        </div>

        <div className="mt-auto flex items-center gap-2 border-t border-app-border pt-4">
          <CTAButton
            type="button"
            variant="secondary"
            onClick={onClear}
            className="flex-1 justify-center"
          >
            {t('admin.analyticsFiltersClear')}
          </CTAButton>
          <CTAButton
            type="button"
            variant="primary"
            onClick={onApply}
            className="flex-1 justify-center"
          >
            {t('admin.analyticsFiltersApply')}
          </CTAButton>
        </div>
      </div>
    </SlideOverPanel>
  );
};
