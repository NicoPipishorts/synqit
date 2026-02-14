import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  RouterProvider,
} from '@tanstack/react-router';

import { AppShell } from './components/shell/AppShell';
import { isAuthenticated } from './lib/auth';
import { I18nProvider } from './lib/i18n';
import { AuthForm } from './pages/AuthForm';
import { DashboardPage } from './pages/DashboardPage';
import { EventCreatePage } from './pages/EventCreatePage';
import { EventPublicPage } from './pages/EventPublicPage';
import { HomePage } from './pages/HomePage';
import { HostEventsPage } from './pages/HostEventsPage';
import { ProfilePage } from './pages/ProfilePage';
import { ProviderConnectionsPage } from './pages/ProviderConnectionsPage';

const queryClient = new QueryClient();

const rootRoute = createRootRoute({
  component: AppShell,
});

const requireAuth = () => {
  if (!isAuthenticated()) {
    throw redirect({
      to: '/auth/login',
    });
  }
};

const redirectIfAuthenticated = () => {
  if (isAuthenticated()) {
    throw redirect({
      to: '/dashboard',
    });
  }
};

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
});

const providersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/providers',
  beforeLoad: requireAuth,
  component: ProviderConnectionsPage,
});

const eventsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/events',
  beforeLoad: requireAuth,
  component: HostEventsPage,
});

const eventCreateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/events/new',
  beforeLoad: requireAuth,
  component: EventCreatePage,
});

const eventPublicRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/event/$magicLinkToken',
  component: EventPublicPage,
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/register',
  beforeLoad: redirectIfAuthenticated,
  component: () => <AuthForm endpoint="/v1/auth/register" />,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/login',
  beforeLoad: redirectIfAuthenticated,
  component: () => <AuthForm endpoint="/v1/auth/login" />,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  beforeLoad: requireAuth,
  component: DashboardPage,
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  beforeLoad: requireAuth,
  component: ProfilePage,
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  providersRoute,
  eventsRoute,
  eventCreateRoute,
  eventPublicRoute,
  registerRoute,
  loginRoute,
  dashboardRoute,
  profileRoute,
]);
const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <RouterProvider router={router} />
      </I18nProvider>
    </QueryClientProvider>
  );
}
