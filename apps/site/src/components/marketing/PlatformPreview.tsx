export const PlatformPreview = () => {
  const mobileShots = ['Guest Add Track', 'Magic Link View', 'Playlist Queue'];
  const tabletShots = ['Host Playlist List', 'Provider Connect', 'Track Moderation'];
  const desktopShots = ['Campaign Overview', 'Live Queue Control', 'Playlist Detail Analytics'];

  const renderShot = (label: string, aspectClassName: string) => (
    <div
      key={label}
      className={`overflow-hidden rounded-2xl border border-app-border bg-brand-gradient p-2 shadow-soft-lift dark:border-app-border ${aspectClassName}`}
    >
      <div className="flex h-full flex-col rounded-xl bg-app-elevated/90 p-3 dark:bg-app-card/90">
        <div className="mb-3 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-brand-pink/80" />
          <span className="h-2 w-2 rounded-full bg-brand-lime/80" />
          <span className="h-2 w-2 rounded-full bg-app-border" />
        </div>
        <div className="mt-auto text-xs font-semibold text-brand-dark dark:text-brand-white">
          {label}
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3 sm:hidden">
        {mobileShots.map((label) => renderShot(label, 'aspect-[9/16]'))}
      </div>
      <div className="hidden grid-cols-3 gap-3 sm:grid lg:hidden">
        {tabletShots.map((label) => renderShot(label, 'aspect-[4/3]'))}
      </div>
      <div className="hidden grid-cols-3 gap-3 lg:grid">
        {desktopShots.map((label) => renderShot(label, 'aspect-[16/10]'))}
      </div>
    </div>
  );
};
