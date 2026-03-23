import { type ReactNode } from 'react';

import { LanguageSwitcher } from '../ui/LanguageSwitcher';

type AuthPageLayoutProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export const AuthPageLayout = ({ title, description, children }: AuthPageLayoutProps) => {
  return (
    <section className="relative mx-auto flex min-h-svh min-h-dvh w-full max-w-4xl items-start px-4 pb-8 pt-[calc(env(safe-area-inset-top)+5rem)] sm:min-h-[calc(100svh-8rem)] sm:items-center sm:px-6 sm:py-12 lg:px-8 lg:py-16">
      <div className="relative grid w-full gap-6">
        <div className="mx-auto grid w-full max-w-xl gap-2 text-center">
          <h1 className="text-3xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-4xl">
            {title}
          </h1>
          {description ? <p className="text-sm text-app-text-secondary">{description}</p> : null}
        </div>

        {children}

        <div className="mx-auto flex w-full max-w-xl justify-center">
          <div className="flex items-center rounded-full border border-app-border/70 bg-app-elevated/90 px-2 py-1.5 shadow-soft-lift backdrop-blur-md dark:bg-app-card/90">
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </section>
  );
};
