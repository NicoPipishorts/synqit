import { type ReactNode } from 'react';

type AppEmptyStateProps = {
  title: string;
  body?: string;
  icon?: ReactNode;
  action?: ReactNode;
};

/**
 * Decorative corner-bracket empty state shared across the app's list pages.
 * Callers control outer layout/centering and pass an optional icon and action(s).
 */
export const AppEmptyState = ({ title, body, icon, action }: AppEmptyStateProps) => (
  <div className="relative w-85 p-6 sm:w-[35vw] sm:p-10">
    <span
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 h-7 w-7 rounded-tl-lg border-l border-t border-brand-dark dark:border-brand-white"
    />
    <span
      aria-hidden="true"
      className="pointer-events-none absolute right-0 top-0 h-7 w-7 rounded-tr-lg border-r border-t border-brand-dark dark:border-brand-white"
    />
    <span
      aria-hidden="true"
      className="pointer-events-none absolute bottom-0 left-0 h-7 w-7 rounded-bl-lg border-b border-l border-brand-dark dark:border-brand-white"
    />
    <span
      aria-hidden="true"
      className="pointer-events-none absolute bottom-0 right-0 h-7 w-7 rounded-br-lg border-b border-r border-brand-dark dark:border-brand-white"
    />
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
