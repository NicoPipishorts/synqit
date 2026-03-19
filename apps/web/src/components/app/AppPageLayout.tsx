import { type ReactNode } from 'react';

type AppPageLayoutProps = {
  children: ReactNode;
  backdrop?: ReactNode;
  bodyClassName?: string;
  className?: string;
};

export const AppPageLayout = ({
  children,
  bodyClassName = 'gap-6',
  className,
}: AppPageLayoutProps) => (
  <section
    className={`relative mx-auto flex min-h-svh w-full max-w-6xl flex-col px-4 pb-28 pt-28 sm:px-6 sm:pb-16 sm:pt-32 lg:px-8 ${
      className ?? ''
    }`.trim()}
  >
    <div className={`relative grid ${bodyClassName}`.trim()}>{children}</div>
  </section>
);
