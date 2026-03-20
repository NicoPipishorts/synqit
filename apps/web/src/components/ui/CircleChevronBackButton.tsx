import { Link } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';

type CircleChevronBackButtonProps = {
  to: string;
  label: string;
};

export const CircleChevronBackButton = ({ to, label }: CircleChevronBackButtonProps) => {
  return (
    <Link
      to={to}
      aria-label={label}
      className="absolute inline-flex h-10 w-10 items-center justify-center rounded-full border border-app-border bg-app-elevated text-app-text shadow-soft-lift transition hover:border-brand-pink dark:bg-app-card"
    >
      <ChevronLeft size={18} aria-hidden="true" />
    </Link>
  );
};
