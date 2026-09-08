/**
 * Full-screen animated brand loader shown while a route chunk loads.
 *
 * Two files, one per ground, for the reason `BrandLogo` carries two lockups: the
 * mark is black-bodied, so on the dark app background only its lime keyline
 * survived — about a device pixel wide, which read as a thin scribble rather
 * than a spinner. `loader-dark.svg` draws the same mark in lime. Both carry
 * their own spring-spin keyframes; `display: none` keeps the idle one from
 * animating.
 */
export const RouteLoadingScreen = () => (
  <div className="flex min-h-screen items-center justify-center px-4 pt-24">
    <img
      src="/assets/logos/loader.svg"
      alt=""
      aria-hidden="true"
      className="route-loader-logo h-24 w-24 dark:hidden sm:h-28 sm:w-28"
    />
    <img
      src="/assets/logos/loader-dark.svg"
      alt=""
      aria-hidden="true"
      className="route-loader-logo hidden h-24 w-24 dark:block sm:h-28 sm:w-28"
    />
  </div>
);
