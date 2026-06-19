import { motion } from 'framer-motion';
import { type LucideIcon } from 'lucide-react';

export type PublicMobileNavItem = {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
};

type PublicMobileNavProps = {
  items: PublicMobileNavItem[];
  activeId: string | null;
  onActivate?: (id: string) => void;
  ariaLabel?: string;
};

export const PublicMobileNav = ({
  items,
  activeId,
  onActivate,
  ariaLabel,
}: PublicMobileNavProps) => (
  <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center md:hidden">
    <nav
      className="pointer-events-auto relative flex items-center gap-1 rounded-full border border-app-border/70 bg-white/92 px-2 py-1.5 shadow-[0_18px_42px_-22px_rgba(34,34,34,0.42),0_8px_18px_-14px_rgba(34,34,34,0.26)] backdrop-blur-[6px] dark:bg-app-card/92"
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const isActive = activeId === item.id;
        const Icon = item.icon;
        return (
          <a
            key={item.id}
            href={item.href}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            onPointerDown={() => onActivate?.(item.id)}
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-full transition focus-ring-brand"
          >
            {isActive ? (
              <motion.span
                layoutId="public-mobile-nav-pill"
                transition={{ type: 'spring', stiffness: 430, damping: 35, mass: 0.85 }}
                className="absolute inset-0 rounded-full bg-brand-dark dark:bg-brand-white"
              />
            ) : null}
            <span
              className={`relative z-10 ${
                isActive ? 'text-brand-white dark:text-brand-dark' : 'text-app-text-secondary'
              }`}
            >
              <Icon size={18} aria-hidden="true" />
            </span>
            <span className="sr-only">{item.label}</span>
          </a>
        );
      })}
    </nav>
  </div>
);
