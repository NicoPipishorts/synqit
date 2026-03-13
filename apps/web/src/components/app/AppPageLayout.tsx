import { type ReactNode } from 'react';

type AppPageLayoutProps = {
  children: ReactNode;
  bodyClassName?: string;
  className?: string;
};

export const AppPageLayout = ({
  children,
  bodyClassName = 'gap-6',
  className,
}: AppPageLayoutProps) => (
  <section
    className={`relative mx-auto flex min-h-svh w-full max-w-6xl flex-col px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:px-8 ${
      className ?? ''
    }`.trim()}
  >
    <div className={`relative flex flex-1 items-center justify-center ${bodyClassName}`.trim()}>
      {children}
    </div>
  </section>
);
