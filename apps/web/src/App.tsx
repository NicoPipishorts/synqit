import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  RouterProvider,
} from '@tanstack/react-router';

import { AppShell } from './components/shell/AppShell';
import { ToastProvider } from './components/ui/ToastProvider';
import { isAdminAuthenticated, isAuthenticated } from './lib/auth';
import { I18nProvider } from './lib/i18n';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminPortalPage } from './pages/AdminPortalPage';
import { AuthForm } from './pages/AuthForm';
import { DashboardPage } from './pages/DashboardPage';
import { EventCreatePage } from './pages/EventCreatePage';
import { EventPublicPage } from './pages/EventPublicPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { HomePage } from './pages/HomePage';
import { HostEventDetailsPage } from './pages/HostEventDetailsPage';
import { HostEventsPage } from './pages/HostEventsPage';
import { ProfilePage } from './pages/ProfilePage';
import { ProfilePersonalInfoPage } from './pages/ProfilePersonalInfoPage';
import { ProfilePlatformsPage } from './pages/ProfilePlatformsPage';
import { ProfileSecurityPage } from './pages/ProfileSecurityPage';
import { ProviderOauthCallbackPage } from './pages/ProviderOauthCallbackPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { SyncedListsPage } from './pages/SyncedListsPage';

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

const requireAdminAuth = () => {
  if (!isAuthenticated() || !isAdminAuthenticated()) {
    throw redirect({
      to: '/admin/login',
    });
  }
};

const redirectIfAdminAuthenticated = () => {
  if (isAuthenticated() && isAdminAuthenticated()) {
    throw redirect({
      to: '/admin',
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
  beforeLoad: () => {
    requireAuth();
    throw redirect({
      to: '/profile/platforms',
    });
  },
});

const syncedListsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/synced-lists',
  beforeLoad: requireAuth,
  component: SyncedListsPage,
});

const eventsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/events',
  beforeLoad: requireAuth,
  component: HostEventsPage,
});

const eventDetailsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/events/$eventId',
  beforeLoad: requireAuth,
  component: HostEventDetailsPage,
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

const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/forgot-password',
  beforeLoad: redirectIfAuthenticated,
  component: ForgotPasswordPage,
});

const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/reset-password',
  beforeLoad: redirectIfAuthenticated,
  component: ResetPasswordPage,
});

const adminLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/login',
  beforeLoad: redirectIfAdminAuthenticated,
  component: AdminLoginPage,
});

const adminPortalRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  beforeLoad: requireAdminAuth,
  component: AdminPortalPage,
});

const providerOauthCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/provider-connected',
  component: ProviderOauthCallbackPage,
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

const profilePlatformsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile/platforms',
  beforeLoad: requireAuth,
  component: ProfilePlatformsPage,
});

const profilePersonalInfoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile/personal-info',
  beforeLoad: requireAuth,
  component: ProfilePersonalInfoPage,
});

const profileSecurityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile/security',
  beforeLoad: requireAuth,
  component: ProfileSecurityPage,
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  providersRoute,
  syncedListsRoute,
  eventsRoute,
  eventDetailsRoute,
  eventCreateRoute,
  eventPublicRoute,
  registerRoute,
  loginRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  adminLoginRoute,
  adminPortalRoute,
  providerOauthCallbackRoute,
  dashboardRoute,
  profileRoute,
  profilePlatformsRoute,
  profilePersonalInfoRoute,
  profileSecurityRoute,
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
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
