/** Full-screen animated brand loader shown while a route chunk loads. */
export const RouteLoadingScreen = () => (
  <div className="flex min-h-screen items-center justify-center px-4 pt-24">
    <img
      src="/assets/logos/loader.svg"
      alt=""
      aria-hidden="true"
      className="route-loader-logo h-24 w-24 sm:h-28 sm:w-28"
    />
  </div>
);
