import { useNavigate } from '@tanstack/react-router';
import { ArrowUpRight } from 'lucide-react';
import { type KeyboardEvent } from 'react';

export type PlaylistCardRole = 'owner' | 'guest' | 'subscriber';

type DashboardPlaylistCardProps = {
  playlistName: string;
  href: string;
  role: PlaylistCardRole;
  roleLabel: string;
  signal: string | null;
  signalActive?: boolean;
};

const roleStyles: Record<PlaylistCardRole, string> = {
  owner: 'bg-brand-lime/15 text-[#6d9600] dark:text-[#d5ff5c]',
  guest: 'bg-sky-400/15 text-sky-700 dark:text-sky-300',
  subscriber: 'bg-purple-400/15 text-purple-700 dark:text-purple-300',
};

export const DashboardPlaylistCard = ({
  playlistName,
  href,
  role,
  roleLabel,
  signal,
  signalActive,
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

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={activate}
      onKeyDown={onKeyDown}
      className="group flex cursor-pointer items-center gap-3 border-b border-app-border px-4 py-3.5 transition-colors hover:bg-brand-pink/5 focus:bg-brand-pink/5 focus:outline-none last:border-b-0"
    >
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black text-brand-dark transition-colors group-hover:text-brand-pink group-focus:text-brand-pink dark:text-brand-white dark:group-hover:text-brand-pink dark:group-focus:text-brand-pink">
          {playlistName}
        </span>
        {signal ? (
          <span
            className={`mt-0.5 block truncate text-xs ${signalActive ? 'text-brand-dark dark:text-brand-white font-semibold' : 'text-app-text-secondary'}`}
          >
            {signal}
          </span>
        ) : null}
      </div>

      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${roleStyles[role]}`}
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
