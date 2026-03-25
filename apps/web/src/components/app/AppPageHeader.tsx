import { type ReactNode } from 'react';

import { CircleChevronBackButton } from '../ui/CircleChevronBackButton';

type AppPageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  backTo?: string;
  backLabel?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  descriptionClassName?: string;
};

export const AppPageHeader = ({
  eyebrow,
  title,
  description,
  backTo,
  backLabel,
  actions,
  children,
  className,
  descriptionClassName,
}: AppPageHeaderProps) => (
  <article className={className}>
    <div className="sm:px-2 sm:pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {backTo ? <CircleChevronBackButton to={backTo} label={backLabel ?? title} /> : null}
        <div className={`grid flex-1 gap-3${backTo ? ' ml-12 sm:ml-14' : ''}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between ">
            <div className="grid gap-1">
              {eyebrow ? (
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-app-text-secondary">
                  {eyebrow}
                </p>
              ) : null}
              <h1 className="text-2xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-5xl">
                {title}
              </h1>
              {description ? (
                <p
                  className={descriptionClassName ?? 'text-sm text-app-text-secondary sm:text-base'}
                >
                  {description}
                </p>
              ) : null}
              {actions ? <div className="flex w-full sm:hidden">{actions}</div> : null}
            </div>
            {actions ? <div className="hidden items-center gap-2 sm:flex">{actions}</div> : null}
          </div>
          {children}
        </div>
      </div>
    </div>
  </article>
);
