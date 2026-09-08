/**
 * Geometry of the pill navbar: the bordered bar and the items inside it.
 * Exported so apps can render the same bar with their own router's `Link`
 * (see the web app's `PrivateDesktopNavigation`) without the sizes drifting.
 * Colour and indicator classes stay with each nav, only the box is shared.
 */
export const NAV_BAR_CLASS =
  'flex items-center gap-1 rounded-full border-2 border-app-text bg-app-elevated px-2 py-1.5 shadow-sticker dark:bg-app-card';

/**
 * `font-black` asks for 900, but the rendering font tops out at 800, so the weight axis
 * has nothing left to give. Size and tracking carry the extra heft instead: a point larger
 * and set solid rather than loosened. The bar is `hidden md:block` in both apps, so this
 * only ever applies on desktop.
 */
export const NAV_ITEM_CLASS =
  'relative inline-flex h-10 items-center rounded-full px-3 text-[15px] font-black tracking-[-0.005em] transition focus-ring-brand lg:px-4';
