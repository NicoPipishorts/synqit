import { ReactNode } from 'react';

import { useI18n } from '../../hooks/useI18n';

type AdminPageHeaderProps = {
  nav: ReactNode;
};

export const AdminPageHeader = ({ nav }: AdminPageHeaderProps) => {
  const { t } = useI18n();

  return (
    <header className="mb-2 flex flex-col items-start gap-2 sm:mb-3">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-3xl font-black tracking-tight leading-tight text-brand-dark dark:text-brand-white">
          {t('admin.portalTitle')}
        </h1>
        <p className="text-sm font-semibold text-app-text-secondary">{t('admin.portalSubtitle')}</p>
      </div>
      {nav}
    </header>
  );
};
