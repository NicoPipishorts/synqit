import { type ReactNode } from 'react';

import { CircleChevronBackButton } from '../ui/CircleChevronBackButton';

type AppPageHeaderProps = {
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
    <div className="px-5 py-7 sm:px-8 sm:py-9">
      <div className="flex items-start gap-4">
        {backTo ? <CircleChevronBackButton to={backTo} label={backLabel ?? title} /> : null}
        <div className="grid flex-1 gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="grid gap-1">
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
            </div>
            {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
          </div>
          {children}
        </div>
      </div>
    </div>
  </article>
);
