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
    className={`relative mx-auto w-full max-w-6xl px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:px-8 ${
      className ?? ''
    }`.trim()}
  >
    <div className={`relative grid ${bodyClassName}`.trim()}>{children}</div>
  </section>
);
