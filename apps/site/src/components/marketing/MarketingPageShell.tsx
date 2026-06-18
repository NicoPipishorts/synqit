import { type ReactNode } from 'react';

import { HomeFooterReveal } from './HomeFooterReveal';

type MarketingPageShellProps = {
  children: ReactNode;
  contentClassName?: string;
};

export const MarketingPageShell = ({ children, contentClassName }: MarketingPageShellProps) => (
  <div className="relative bg-brand-dark dark:bg-brand-white">
    <HomeFooterReveal />

    <div className="relative z-10 overflow-hidden rounded-b-[2.75rem] bg-app-bg shadow-[0_28px_64px_-20px_rgba(0,0,0,0.55)] dark:shadow-[0_30px_70px_-20px_rgba(0,0,0,0.72)] sm:rounded-b-[3.5rem] lg:rounded-b-[4.5rem]">
      <div className={contentClassName ?? 'relative z-10 mx-auto w-full'}>{children}</div>
    </div>

    <div aria-hidden className="h-[30rem] sm:h-96 lg:h-104" />
  </div>
);
