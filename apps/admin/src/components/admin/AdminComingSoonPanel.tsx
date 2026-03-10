type AdminComingSoonPanelProps = {
  title: string;
  message: string;
};

export const AdminComingSoonPanel = ({ title, message }: AdminComingSoonPanelProps) => {
  return (
    <div className="relative w-full max-w-2xl px-8 py-16 text-center">
      <span className="absolute left-0 top-0 h-10 w-10 border-l border-t border-app-border" />
      <span className="absolute right-0 top-0 h-10 w-10 border-r border-t border-app-border" />
      <span className="absolute bottom-0 left-0 h-10 w-10 border-b border-l border-app-border" />
      <span className="absolute bottom-0 right-0 h-10 w-10 border-b border-r border-app-border" />

      <div className="grid gap-3">
        <h2 className="text-4xl font-black tracking-tight text-brand-dark dark:text-brand-white">
          {title}
        </h2>
        <p className="text-base text-app-text-secondary">{message}</p>
      </div>
    </div>
  );
};
