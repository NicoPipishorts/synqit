import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';

import { toApiAssetUrl } from '../../lib/apiAssetUrl';

export type DashboardFollower = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  subscriptionCount: number;
};

type DashboardFollowersRowProps = {
  followers: DashboardFollower[];
  title: string;
  subtitle: string;
  viewAllLabel: string;
  viewAllTo: string;
  emptyLabel: string;
};

const getNameInitials = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed) return 'U';

  const segments =
    trimmed
      .split('@')[0]
      ?.split(/[\s._-]+/)
      .filter(Boolean) ?? [];
  if (segments.length === 0) return trimmed.slice(0, 1).toUpperCase();
  if (segments.length === 1) return segments[0].slice(0, 2).toUpperCase();
  return `${segments[0][0] ?? ''}${segments[1][0] ?? ''}`.toUpperCase();
};

export const DashboardFollowersRow = ({
  followers,
  title,
  subtitle,
  viewAllLabel,
  viewAllTo,
  emptyLabel,
}: DashboardFollowersRowProps) => (
  <section className="grid gap-4">
    <div className="px-1">
      <h2 className="text-base font-black tracking-tight text-brand-dark dark:text-brand-white">
        {title}
      </h2>
      <p className="mt-0.5 text-xs text-app-text-secondary">{subtitle}</p>
    </div>

    <div className="rounded-2xl border border-app-border bg-app-elevated px-4 py-4 dark:bg-app-card shadow-soft-lift">
      {followers.length === 0 ? (
        <p className="text-sm text-app-text-secondary">{emptyLabel}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {followers.map((follower) => {
            const avatarSrc = toApiAssetUrl(follower.avatarUrl);
            return (
              <div
                key={follower.userId}
                className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-app-border bg-app-surface text-sm font-bold text-brand-dark shadow-soft-lift dark:text-brand-white"
                title={follower.name}
              >
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt={follower.name}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <span aria-hidden="true">{getNameInitials(follower.name)}</span>
                )}
              </div>
            );
          })}

          <Link
            to={viewAllTo}
            aria-label={viewAllLabel}
            title={viewAllLabel}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-dashed border-app-border bg-app-surface text-app-text-secondary shadow-soft-lift transition hover:border-brand-pink hover:text-brand-pink"
          >
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  </section>
);
