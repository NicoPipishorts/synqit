import { useNavigate } from '@tanstack/react-router';
import { type KeyboardEvent } from 'react';

export type ActivityFeedItem = {
  id: string;
  description: string;
  playlistName: string;
  href: string;
  timeLabel: string | null;
};

type DashboardActivityFeedProps = {
  items: ActivityFeedItem[];
  emptyLabel: string;
  unknownTimeLabel: string;
};

export const DashboardActivityFeed = ({
  items,
  emptyLabel,
  unknownTimeLabel,
}: DashboardActivityFeedProps) => {
  const navigate = useNavigate();

  const activate = (href: string) => {
    void navigate({ to: href as never });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>, href: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate(href);
    }
  };

  if (items.length === 0) {
    return <p className="px-4 py-5 text-sm text-app-text-secondary">{emptyLabel}</p>;
  }

  return (
    <ul className="divide-y divide-app-border">
      {items.map((item) => (
        <li key={item.id}>
          <div
            role="link"
            tabIndex={0}
            onClick={() => activate(item.href)}
            onKeyDown={(e) => onKeyDown(e, item.href)}
            className="group flex cursor-pointer items-start gap-3 px-4 py-3.5 transition-colors hover:bg-brand-pink/5 focus:bg-brand-pink/5 focus:outline-none"
          >
            <span
              aria-hidden="true"
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-app-text-secondary/50 group-hover:bg-brand-pink/60 group-focus:bg-brand-pink/60 transition-colors"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-brand-dark dark:text-brand-white">
                <span className="font-semibold transition-colors group-hover:text-brand-pink group-focus:text-brand-pink">
                  {item.playlistName}
                </span>
                {' — '}
                <span className="text-app-text-secondary">{item.description}</span>
              </p>
            </div>
            <span className="shrink-0 pt-px text-xs text-app-text-secondary tabular-nums">
              {item.timeLabel ?? unknownTimeLabel}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
};
