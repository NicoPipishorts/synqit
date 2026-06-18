import { QueryClientProvider } from '@tanstack/react-query';
import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  RouterProvider,
} from '@tanstack/react-router';
import { useEffect } from 'react';

import { ToastProvider } from './components/ui/ToastProvider';
import { buildAdminAppUrl } from './lib/admin-url';
import { isAuthenticated } from './lib/auth';
import { I18nProvider } from './lib/i18n';
import { createLazyRouteComponent } from './lib/lazy-route';
import { queryClient } from './lib/queryClient';
import { EventPublicPage } from './pages/EventPublicPage';
import { SyncPublicPage } from './pages/SyncPublicPage';

const AppShell = createLazyRouteComponent(() =>
  import('./components/shell/AppShell').then((module) => ({
    default: module.AppShell,
  })),
);
const DashboardPage = createLazyRouteComponent(() =>
  import('./pages/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
);
const HostEventsPage = createLazyRouteComponent(() =>
  import('./pages/HostEventsPage').then((module) => ({
    default: module.HostEventsPage,
  })),
);
const HostEventDetailsPage = createLazyRouteComponent(() =>
  import('./pages/HostEventDetailsPage').then((module) => ({
    default: module.HostEventDetailsPage,
  })),
);
const EventCreatePage = createLazyRouteComponent(() =>
  import('./pages/EventCreatePage').then((module) => ({
    default: module.EventCreatePage,
  })),
);
const SyncedListsPage = createLazyRouteComponent(() =>
  import('./pages/SyncedListsPage').then((module) => ({
    default: module.SyncedListsPage,
  })),
);
const SyncCreatePage = createLazyRouteComponent(() =>
  import('./pages/SyncCreatePage').then((module) => ({
    default: module.SyncCreatePage,
  })),
);
const SyncDetailsPage = createLazyRouteComponent(() =>
  import('./pages/SyncDetailsPage').then((module) => ({
    default: module.SyncDetailsPage,
  })),
);
const FollowersPage = createLazyRouteComponent(() =>
  import('./pages/FollowersPage').then((module) => ({
    default: module.FollowersPage,
  })),
);
const ProfilePage = createLazyRouteComponent(() =>
  import('./pages/ProfilePage').then((module) => ({
    default: module.ProfilePage,
  })),
);
const ProfilePlatformsPage = createLazyRouteComponent(() =>
  import('./pages/ProfilePlatformsPage').then((module) => ({
    default: module.ProfilePlatformsPage,
  })),
);
const ProfilePersonalInfoPage = createLazyRouteComponent(() =>
  import('./pages/ProfilePersonalInfoPage').then((module) => ({
    default: module.ProfilePersonalInfoPage,
  })),
);
const ProfileSecurityPage = createLazyRouteComponent(() =>
  import('./pages/ProfileSecurityPage').then((module) => ({
    default: module.ProfileSecurityPage,
  })),
);
const ProviderOauthCallbackPage = createLazyRouteComponent(() =>
  import('./pages/ProviderOauthCallbackPage').then((module) => ({
    default: module.ProviderOauthCallbackPage,
  })),
);
const ForgotPasswordPage = createLazyRouteComponent(() =>
  import('./pages/ForgotPasswordPage').then((module) => ({
    default: module.ForgotPasswordPage,
  })),
);
const ResetPasswordPage = createLazyRouteComponent(() =>
  import('./pages/ResetPasswordPage').then((module) => ({
    default: module.ResetPasswordPage,
  })),
);
const RegisterPage = createLazyRouteComponent(() =>
  import('./pages/AuthForm').then((module) => ({
    default: () => <module.AuthForm endpoint="/v1/auth/register" />,
  })),
);
const LoginPage = createLazyRouteComponent(() =>
  import('./pages/AuthForm').then((module) => ({
    default: () => <module.AuthForm endpoint="/v1/auth/login" />,
  })),
);

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

const AdminAppRedirect = ({ path }: { path: string }) => {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.location.replace(buildAdminAppUrl(path));
  }, [path]);

  return null;
};

const appEntryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({
      to: isAuthenticated() ? '/dashboard' : '/auth/login',
    });
  },
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

const syncCreateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/synced-lists/new',
  beforeLoad: requireAuth,
  component: SyncCreatePage,
});

const syncDetailsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/synced-lists/$syncId',
  beforeLoad: requireAuth,
  component: SyncDetailsPage,
});

const syncPublicRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sync/$token',
  component: SyncPublicPage,
});

const eventsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/playlists',
  beforeLoad: requireAuth,
  component: HostEventsPage,
});
const legacyEventsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/events',
  beforeLoad: () => {
    requireAuth();
    throw redirect({ to: '/playlists' });
  },
});

const eventDetailsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/playlists/$eventId',
  beforeLoad: requireAuth,
  component: HostEventDetailsPage,
});
const legacyEventDetailsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/events/$eventId',
  beforeLoad: ({ params }) => {
    requireAuth();
    throw redirect({ to: '/playlists/$eventId', params: { eventId: params.eventId } });
  },
});

const eventCreateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/playlists/new',
  beforeLoad: requireAuth,
  component: EventCreatePage,
});
const legacyEventCreateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/events/new',
  beforeLoad: () => {
    requireAuth();
    throw redirect({ to: '/playlists/new' });
  },
});

const eventPublicRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/playlist/$magicLinkToken',
  component: EventPublicPage,
});
const legacyEventPublicRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/event/$magicLinkToken',
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/playlist/$magicLinkToken',
      params: { magicLinkToken: params.magicLinkToken },
    });
  },
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/register',
  beforeLoad: redirectIfAuthenticated,
  component: RegisterPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/login',
  beforeLoad: redirectIfAuthenticated,
  component: LoginPage,
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
  component: () => <AdminAppRedirect path="/login" />,
});

const adminPortalRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: () => <AdminAppRedirect path="/dashboard" />,
});

const adminDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/dashboard',
  component: () => <AdminAppRedirect path="/dashboard" />,
});

const adminUsersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/users',
  component: () => <AdminAppRedirect path="/users" />,
});

const adminAnalyticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/analytics',
  component: () => <AdminAppRedirect path="/analytics" />,
});

const adminEmailsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/emails',
  component: () => <AdminAppRedirect path="/emails" />,
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

const followersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/followers',
  beforeLoad: requireAuth,
  component: FollowersPage,
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
  appEntryRoute,
  providersRoute,
  syncedListsRoute,
  syncCreateRoute,
  syncDetailsRoute,
  syncPublicRoute,
  eventsRoute,
  legacyEventsRoute,
  eventDetailsRoute,
  legacyEventDetailsRoute,
  eventCreateRoute,
  legacyEventCreateRoute,
  eventPublicRoute,
  legacyEventPublicRoute,
  registerRoute,
  loginRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  adminLoginRoute,
  adminPortalRoute,
  adminDashboardRoute,
  adminUsersRoute,
  adminAnalyticsRoute,
  adminEmailsRoute,
  providerOauthCallbackRoute,
  dashboardRoute,
  followersRoute,
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
