import { type ReactNode } from 'react';

type AppSectionHeadingProps = {
  title: string;
  description?: string;
  count?: number;
  action?: ReactNode;
};

/** Consistent section heading with an optional count badge and trailing action. */
export const AppSectionHeading = ({
  title,
  description,
  count,
  action,
}: AppSectionHeadingProps) => (
  <div className="flex items-start justify-between gap-3">
    <div className="grid gap-1">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-black tracking-tight text-brand-dark dark:text-brand-white">
          {title}
        </h2>
        {typeof count === 'number' ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-app-border bg-app-surface px-1.5 text-[11px] font-bold tabular-nums text-app-text-secondary dark:bg-app-card">
            {count}
          </span>
        ) : null}
      </div>
      {description ? <p className="text-sm text-app-text-secondary">{description}</p> : null}
    </div>
    {action ? <div className="shrink-0">{action}</div> : null}
  </div>
);
