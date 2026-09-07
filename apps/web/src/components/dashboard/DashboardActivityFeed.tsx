import { useNavigate } from '@tanstack/react-router';
import { Music, UserPlus } from 'lucide-react';
import { type KeyboardEvent } from 'react';

export type ActivityFeedKind = 'subscriber' | 'songs';

export type ActivityFeedItem = {
  id: string;
  kind: ActivityFeedKind;
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

const kindStyles: Record<ActivityFeedKind, string> = {
  subscriber: 'border-2 border-app-text bg-brand-lime text-brand-dark',
  songs: 'border-2 border-app-text bg-brand-pink text-brand-white',
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
      {items.map((item) => {
        const Icon = item.kind === 'subscriber' ? UserPlus : Music;
        return (
          <li key={item.id}>
            <div
              role="link"
              tabIndex={0}
              onClick={() => activate(item.href)}
              onKeyDown={(e) => onKeyDown(e, item.href)}
              className="group flex cursor-pointer items-center gap-3 px-4 py-3.5 transition-colors hover:bg-brand-pink/5 focus:bg-brand-pink/5 focus:outline-none"
            >
              <span
                aria-hidden="true"
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${kindStyles[item.kind]}`}
              >
                <Icon size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-brand-dark transition-colors group-hover:text-brand-pink group-focus:text-brand-pink dark:text-brand-white">
                  {item.playlistName}
                </p>
                <p className="truncate text-xs text-app-text-secondary">{item.description}</p>
              </div>
              <span className="shrink-0 self-start pt-px text-xs text-app-text-secondary tabular-nums">
                {item.timeLabel ?? unknownTimeLabel}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
};
