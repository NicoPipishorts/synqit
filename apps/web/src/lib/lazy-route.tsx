import { type ComponentType, type LazyExoticComponent, Suspense, lazy } from 'react';

import { RouteLoadingScreen } from '../components/ui/RouteLoadingScreen';

type ModuleWithDefault<TProps extends object> = {
  default: ComponentType<TProps>;
};

export const createLazyRouteComponent = <TProps extends object>(
  loader: () => Promise<ModuleWithDefault<TProps>>,
) => {
  const LazyComponent: LazyExoticComponent<ComponentType<TProps>> = lazy(loader);

  const LazyRouteComponent = (props: TProps) => {
    return (
      <Suspense fallback={<RouteLoadingScreen />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };

  return LazyRouteComponent;
};
