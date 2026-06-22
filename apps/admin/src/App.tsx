import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  RouterProvider,
} from '@tanstack/react-router';

import { AdminShell } from './components/shell/AdminShell';
import { ToastProvider } from './components/ui/ToastProvider';
import { useI18n } from './hooks/useI18n';
import { isAdminAuthenticated } from './lib/auth';
import { I18nProvider } from './lib/i18n';
import { AdminAnalyticsPage } from './pages/AdminAnalyticsPage';
import { AdminEmailsPage } from './pages/AdminEmailsPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminUserDetailsPage } from './pages/AdminUserDetailsPage';
import { AdminUsersPage } from './pages/AdminUsersPage';

const rootRoute = createRootRoute({
  component: AdminShell,
});

const requireAdminAuth = () => {
  if (!isAdminAuthenticated()) {
    throw redirect({
      to: '/login',
    });
  }
};

const redirectIfAdminAuthenticated = () => {
  if (isAdminAuthenticated()) {
    throw redirect({
      to: '/users',
    });
  }
};

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({
      to: isAdminAuthenticated() ? '/users' : '/login',
    });
  },
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: redirectIfAdminAuthenticated,
  component: AdminLoginPage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  beforeLoad: () => {
    throw redirect({
      to: '/users',
    });
  },
});

const usersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/users',
  beforeLoad: requireAdminAuth,
  component: AdminUsersPage,
});

const userDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/users/$userId',
  beforeLoad: requireAdminAuth,
  component: AdminUserDetailsPage,
});

const userDetailAccessRoute = createRoute({
  getParentRoute: () => userDetailRoute,
  path: 'access',
  component: () => null,
});

const userDetailPlaylistsRoute = createRoute({
  getParentRoute: () => userDetailRoute,
  path: 'playlists',
  component: () => null,
});

const userDetailActivityRoute = createRoute({
  getParentRoute: () => userDetailRoute,
  path: 'activity',
  component: () => null,
});

const analyticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/analytics',
  beforeLoad: requireAdminAuth,
  component: AdminAnalyticsPage,
});

const emailsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/emails',
  beforeLoad: requireAdminAuth,
  component: AdminEmailsPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  dashboardRoute,
  usersRoute,
  userDetailRoute.addChildren([
    userDetailAccessRoute,
    userDetailPlaylistsRoute,
    userDetailActivityRoute,
  ]),
  analyticsRoute,
  emailsRoute,
]);

const router = createRouter({
  routeTree,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const AdminApp = () => {
  const { locale } = useI18n();

  return (
    <ToastProvider key={locale}>
      <RouterProvider router={router} />
    </ToastProvider>
  );
};

export default function App() {
  return (
    <I18nProvider>
      <AdminApp />
    </I18nProvider>
  );
}
