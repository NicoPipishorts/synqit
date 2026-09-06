import { useNavigate } from '@tanstack/react-router';
import { ArrowUpRight, CalendarDays, Repeat } from 'lucide-react';
import { type KeyboardEvent } from 'react';

export type PlaylistCardRole = 'owner' | 'visited' | 'tracked' | 'subscriber';
export type PlaylistCardType = 'event' | 'sync';

type DashboardPlaylistCardProps = {
  playlistName: string;
  href: string;
  role: PlaylistCardRole;
  roleLabel: string;
  type: PlaylistCardType;
  signal: string | null;
  signalActive?: boolean;
  live?: boolean;
};

const roleStyles: Record<PlaylistCardRole, string> = {
  owner: 'bg-brand-lime text-brand-dark',
  visited: 'bg-[#7dd3fc] text-brand-dark',
  tracked: 'bg-app-text text-app-bg',
  subscriber: 'bg-brand-pink text-brand-white',
};

export const DashboardPlaylistCard = ({
  playlistName,
  href,
  role,
  roleLabel,
  type,
  signal,
  signalActive,
  live,
}: DashboardPlaylistCardProps) => {
  const navigate = useNavigate();

  const activate = () => {
    void navigate({ to: href as never });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate();
    }
  };

  const TypeIcon = type === 'event' ? CalendarDays : Repeat;

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={activate}
      onKeyDown={onKeyDown}
      className="group flex cursor-pointer items-center gap-3 border-b border-app-border px-4 py-3.5 transition-colors hover:bg-brand-lime/10 focus:bg-brand-lime/10 focus:outline-none last:border-b-0"
    >
      <span
        aria-hidden="true"
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-app-text ${roleStyles[role]}`}
      >
        <TypeIcon size={18} />
      </span>

      <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-2">
        <span className="flex min-w-0 items-center gap-1.5 sm:flex-1">
          <span className="block min-w-0 truncate text-sm font-black text-brand-dark transition-colors group-hover:text-brand-pink group-focus:text-brand-pink dark:text-brand-white dark:group-hover:text-brand-pink dark:group-focus:text-brand-pink">
            {playlistName}
          </span>
          {live ? (
            <span aria-hidden="true" className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-lime opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-lime" />
            </span>
          ) : null}
        </span>
        {signal ? (
          <span
            className={`mt-0.5 block truncate text-xs sm:mt-0 sm:shrink-0 sm:whitespace-nowrap ${signalActive ? 'font-semibold text-brand-dark dark:text-brand-white' : 'text-app-text-secondary'}`}
          >
            {signal}
          </span>
        ) : null}
      </div>

      <span
        className={`shrink-0 rounded-full border border-app-text px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${roleStyles[role]}`}
      >
        {roleLabel}
      </span>

      <ArrowUpRight
        size={13}
        aria-hidden="true"
        className="shrink-0 text-app-text-secondary transition duration-150 ease-out group-hover:text-brand-pink group-focus:text-brand-pink motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5 motion-safe:group-focus:translate-x-0.5 motion-safe:group-focus:-translate-y-0.5"
      />
    </div>
  );
};
