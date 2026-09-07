import { Sticker } from '@synqit/ui';
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
          <Sticker tone="lime" tilt="-rotate-3" className="px-2.5 tabular-nums">
            {count}
          </Sticker>
        ) : null}
      </div>
      {description ? <p className="text-sm text-app-text-secondary">{description}</p> : null}
    </div>
    {action ? <div className="shrink-0">{action}</div> : null}
  </div>
);
