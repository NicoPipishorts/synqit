type NotificationDotProps = {
  className?: string;
};

export const NotificationDot = ({ className }: NotificationDotProps) => {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-3 w-3 rounded-full bg-brand-pink shadow-[0_0_0_2px_rgba(255,255,255,0.96)] dark:shadow-[0_0_0_2px_rgba(17,24,39,0.96)] ${className ?? ''}`.trim()}
    />
  );
};
