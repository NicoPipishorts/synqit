export const RouteLoadingScreen = () => {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 pt-24">
      <div className="w-full max-w-md rounded-[2rem] border border-app-border bg-app-elevated/95 px-6 py-8 text-center shadow-soft-lift backdrop-blur dark:bg-app-card">
        <div className="mx-auto h-2 w-20 overflow-hidden rounded-full bg-app-border/70">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-brand-lime" />
        </div>
        <p className="mt-4 text-sm font-semibold text-app-text-secondary">Loading page...</p>
      </div>
    </div>
  );
};
