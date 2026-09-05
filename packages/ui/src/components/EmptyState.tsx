import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: string;
  body?: string;
  icon?: ReactNode;
  action?: ReactNode;
};

/**
 * Decorative corner-bracket empty state for list pages. Callers control the
 * outer layout and centring and pass an optional icon and action(s).
 */
export const EmptyState = ({ title, body, icon, action }: EmptyStateProps) => (
  <div className="relative w-85 p-6 sm:w-[35vw] sm:p-10">
    {(
      [
        'left-0 top-0 rounded-tl-lg border-l border-t',
        'right-0 top-0 rounded-tr-lg border-r border-t',
        'bottom-0 left-0 rounded-bl-lg border-b border-l',
        'bottom-0 right-0 rounded-br-lg border-b border-r',
      ] as const
    ).map((corner) => (
      <span
        key={corner}
        aria-hidden="true"
        className={`pointer-events-none absolute h-7 w-7 border-brand-dark dark:border-brand-white ${corner}`}
      />
    ))}
    <div className="flex flex-col items-center gap-6 text-center">
      {icon ? <div className="text-app-text-secondary/40">{icon}</div> : null}
      <div className="flex flex-col items-center gap-2">
        <p className="text-2xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-3xl">
          {title}
        </p>
        {body ? <p className="text-sm text-app-text-secondary sm:text-base">{body}</p> : null}
      </div>
      {action}
    </div>
  </div>
);
