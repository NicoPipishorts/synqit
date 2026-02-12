import { providerSchema } from '@synqit/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Link,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const queryClient = new QueryClient();

const rootRoute = createRootRoute({
  component: () => (
    <div style={{ fontFamily: 'ui-sans-serif, system-ui', margin: '2rem' }}>
      <h1>Synqit v1</h1>
      <nav style={{ display: 'flex', gap: '1rem' }}>
        <Link to="/">Home</Link>
        <Link to="/providers">Providers</Link>
      </nav>
      <hr style={{ margin: '1rem 0' }} />
      <Outlet />
    </div>
  ),
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <p>Web shell is running. Next: auth + playlists.</p>,
});

const providersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/providers',
  component: () => {
    const providers = providerSchema.options;
    return (
      <div>
        <h2>Supported providers (v1)</h2>
        <ul>
          {providers.map((provider) => (
            <li key={provider}>{provider}</li>
          ))}
        </ul>
      </div>
    );
  },
});

const routeTree = rootRoute.addChildren([homeRoute, providersRoute]);
const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
