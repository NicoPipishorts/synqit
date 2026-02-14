import {
  addEventTrackResponseSchema,
  ApiError,
  authResponseSchema,
  authUserSchema,
  deleteEventResponseSchema,
  eventListResponseSchema,
  eventPublicResponseSchema,
  eventResponseSchema,
  eventTrackSearchResponseSchema,
  eventTracksResponseSchema,
  integrationDisconnectResponseSchema,
  integrationListResponseSchema,
  oauthCallbackResponseSchema,
  oauthStartResponseSchema,
  providerSchema,
  refreshTokenRequestSchema,
  removeEventTrackResponseSchema,
  updateEventRequestSchema,
} from '@synqit/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  redirect,
  RouterProvider,
  useParams,
  useRouterState,
} from '@tanstack/react-router';
import { motion, type Variants } from 'framer-motion';
import { Moon, Sun, UserRound } from 'lucide-react';
import {
  FormEvent,
  ReactNode,
  StrictMode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const queryClient = new QueryClient();
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const AUTH_STORAGE_KEY = 'synqit.auth.v1';
const AUTH_CHANGED_EVENT = 'synqit:auth-changed';
const THEME_STORAGE_KEY = 'synqit.theme.v1';
type Provider = (typeof providerSchema.options)[number];
type Theme = 'light' | 'dark';

type AppleDeveloperTokenResponse = {
  provider: 'apple';
  developerToken: string;
  musicKitIdentifier: string;
};

type MusicKitInstance = {
  authorize: () => Promise<string>;
};

declare global {
  interface Window {
    MusicKit?: {
      configure: (options: {
        developerToken: string;
        app: { name: string; build: string };
      }) => MusicKitInstance;
      getInstance?: () => MusicKitInstance;
    };
  }
}

let musicKitScriptPromise: Promise<void> | null = null;
let musicKitConfigured = false;

const loadMusicKitScript = async (): Promise<void> => {
  if (window.MusicKit) {
    return;
  }

  if (!musicKitScriptPromise) {
    musicKitScriptPromise = new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[data-synqit-musickit="true"]',
      );
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener(
          'error',
          () => reject(new Error('MusicKit script failed to load.')),
          {
            once: true,
          },
        );
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js';
      script.async = true;
      script.defer = true;
      script.setAttribute('data-synqit-musickit', 'true');
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('MusicKit script failed to load.'));
      document.head.appendChild(script);
    });
  }

  await musicKitScriptPromise;
};

const ensureMusicKitInstance = async (params: {
  developerToken: string;
  appName: string;
}): Promise<MusicKitInstance> => {
  if (!window.MusicKit) {
    throw new Error('MusicKit is not available in this browser.');
  }

  let maybeInstance: unknown;
  if (!musicKitConfigured) {
    const configureResult = window.MusicKit.configure({
      developerToken: params.developerToken,
      app: {
        name: params.appName || 'synqit',
        build: '0.1.0',
      },
    });
    const maybeThen = (configureResult as { then?: unknown } | undefined)?.then;
    if (typeof maybeThen === 'function') {
      maybeInstance = await Promise.resolve(configureResult as unknown);
    } else {
      maybeInstance = configureResult;
    }
    musicKitConfigured = true;
  }

  const instance =
    (maybeInstance &&
    typeof maybeInstance === 'object' &&
    'authorize' in maybeInstance &&
    typeof (maybeInstance as { authorize?: unknown }).authorize === 'function'
      ? (maybeInstance as MusicKitInstance)
      : null) ?? window.MusicKit.getInstance?.();
  if (!instance || typeof instance.authorize !== 'function') {
    throw new Error('MusicKit authorization is unavailable. Check Apple MusicKit setup and retry.');
  }

  return instance;
};

type StoredAuth = {
  accessToken: string;
  refreshToken: string;
  userEmail: string;
};

const emitAuthChanged = (): void => {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
};

const loadTheme = (): Theme => {
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  if (raw === 'light' || raw === 'dark') {
    return raw;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const applyTheme = (theme: Theme): void => {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};

const loadAuth = (): StoredAuth | null => {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredAuth>;
    if (
      typeof parsed.accessToken !== 'string' ||
      typeof parsed.refreshToken !== 'string' ||
      typeof parsed.userEmail !== 'string'
    ) {
      return null;
    }

    return parsed as StoredAuth;
  } catch {
    return null;
  }
};

const storeAuth = (authResponse: unknown): StoredAuth => {
  const parsed = authResponseSchema.parse(authResponse);
  const nextAuth: StoredAuth = {
    accessToken: parsed.tokens.accessToken,
    refreshToken: parsed.tokens.refreshToken,
    userEmail: parsed.user.email,
  };

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth));
  emitAuthChanged();
  return nextAuth;
};

const clearAuth = (): void => {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  emitAuthChanged();
};

const toApiError = (value: unknown): ApiError => {
  if (value instanceof Error) {
    return {
      code: 'client_error',
      message: value.message,
    };
  }

  if (
    value &&
    typeof value === 'object' &&
    'code' in value &&
    typeof value.code === 'string' &&
    'message' in value &&
    typeof value.message === 'string'
  ) {
    return value as ApiError;
  }

  return {
    code: 'unknown_error',
    message: 'Unexpected error.',
  };
};

const callApi = async <TResponse,>(
  path: string,
  init: RequestInit,
  parser: (payload: unknown) => TResponse,
): Promise<TResponse> => {
  const hasBody = init.body !== undefined && init.body !== null;

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(hasBody ? { 'content-type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    throw toApiError(payload);
  }

  return parser(payload);
};

const getAccessToken = (): string | null => loadAuth()?.accessToken ?? null;

const isAuthenticated = (): boolean => Boolean(loadAuth()?.accessToken);

const getInitials = (email: string): string => {
  const trimmed = email.trim();
  if (!trimmed) {
    return 'U';
  }
  const segments =
    trimmed
      .split('@')[0]
      ?.split(/[._-]+/)
      .filter(Boolean) ?? [];
  if (segments.length === 0) {
    return trimmed.slice(0, 1).toUpperCase();
  }
  if (segments.length === 1) {
    return segments[0].slice(0, 2).toUpperCase();
  }
  return `${segments[0][0] ?? ''}${segments[1][0] ?? ''}`.toUpperCase();
};

type PillVariant = 'lime' | 'pink';
type CtaVariant = 'lime' | 'outline' | 'pink';
type HeroCtaSize = 'md' | 'sm';

const HERO_PILL_VARIANTS: Record<PillVariant, string> = {
  lime: 'border-brand-lime bg-brand-lime/20 text-[#7aa300] dark:text-[#7aa300] shadow-soft-lift dark:shadow-glow-lime',
  pink: 'border-brand-pink bg-brand-pink/15 text-[#b41563] dark:text-[#ff63ac] shadow-soft-lift dark:shadow-glow-pink',
};

const HERO_CTA_VARIANTS: Record<CtaVariant, string> = {
  lime: 'bg-brand-lime text-brand-dark shadow-soft-lift hover:bg-[#b2e600] dark:bg-[#aee000] dark:text-brand-dark dark:hover:bg-[#9fd100] dark:shadow-glow-lime',
  outline:
    'border border-app-border bg-app-elevated text-app-text shadow-soft-lift hover:border-brand-pink dark:border-app-border dark:text-brand-white dark:shadow-glow-pink',
  pink: 'bg-brand-pink text-brand-white shadow-soft-lift hover:bg-[#e0267c] dark:bg-brand-pink dark:text-brand-white dark:hover:bg-[#d12074] dark:shadow-glow-pink',
};

const HERO_CTA_SIZE_VARIANTS: Record<HeroCtaSize, string> = {
  md: 'rounded-xl px-5 py-3 text-sm',
  sm: 'rounded-lg px-3 py-2 text-sm',
};

const SECTION_REVEAL_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 42 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.92,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const GRID_STAGGER_VARIANTS: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.12,
    },
  },
};

const GRID_ITEM_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.72,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const HeroPill = ({ variant, children }: { variant: PillVariant; children: ReactNode }) => (
  <span
    className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${HERO_PILL_VARIANTS[variant]}`}
  >
    {children}
  </span>
);

const HeroCtaLink = ({
  to,
  variant,
  size = 'md',
  onClick,
  className,
  children,
}: {
  to: string;
  variant: CtaVariant;
  size?: HeroCtaSize;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}) => (
  <Link
    to={to}
    onClick={onClick}
    className={`${HERO_CTA_SIZE_VARIANTS[size]} font-semibold transition ${HERO_CTA_VARIANTS[variant]} ${
      className ?? ''
    }`}
  >
    {children}
  </Link>
);

const BrandLogo = ({ className }: { className?: string }) => (
  <img
    src="/assets/logos/logo-full.png"
    alt="Synqit"
    className={className ?? 'h-8 w-auto'}
    loading="eager"
    decoding="async"
  />
);

const ThemeToggle = () => {
  const [theme, setTheme] = useState<Theme>(() => loadTheme());
  const isDark = theme === 'dark';

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return (
    <button
      onClick={() => setTheme((previousTheme) => (previousTheme === 'dark' ? 'light' : 'dark'))}
      type="button"
      className="group inline-flex h-8 w-14 items-center rounded-full border border-app-border bg-app-elevated px-1 shadow-soft-lift transition dark:border-app-border dark:bg-app-elevated dark:shadow-glow-lime"
      aria-label="Toggle light and dark mode"
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full bg-brand-dark text-brand-white transition-transform dark:bg-brand-white dark:text-brand-dark ${
          isDark ? 'translate-x-6' : 'translate-x-0'
        }`}
      >
        {isDark ? <Moon size={14} /> : <Sun size={14} />}
      </span>
    </button>
  );
};

const AccountMenu = () => {
  const [auth, setAuth] = useState<StoredAuth | null>(() => loadAuth());
  const [isOpen, setIsOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const syncAuth = () => setAuth(loadAuth());
    window.addEventListener(AUTH_CHANGED_EVENT, syncAuth);
    window.addEventListener('storage', syncAuth);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncAuth);
      window.removeEventListener('storage', syncAuth);
    };
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current) {
        return;
      }
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const logout = async () => {
    if (!auth) {
      clearAuth();
      setIsOpen(false);
      return;
    }

    setIsBusy(true);
    try {
      const refreshPayload = refreshTokenRequestSchema.parse({
        refreshToken: auth.refreshToken,
      });

      await callApi(
        '/v1/auth/logout',
        {
          method: 'POST',
          body: JSON.stringify(refreshPayload),
        },
        (payload) => payload,
      ).catch(() => undefined);
    } finally {
      clearAuth();
      setAuth(null);
      setIsOpen(false);
      setIsBusy(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((previousValue) => !previousValue)}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-app-border bg-app-elevated text-sm font-bold text-brand-dark shadow-soft-lift transition hover:border-brand-pink dark:border-app-border dark:bg-app-elevated dark:text-brand-white dark:shadow-glow-pink"
        aria-label="Open account menu"
      >
        {auth ? getInitials(auth.userEmail) : <UserRound size={20} aria-hidden="true" />}
      </button>
      {isOpen ? (
        <div className="absolute right-0 z-30 mt-2 w-64 rounded-2xl border border-app-border bg-app-elevated p-3 shadow-xl dark:border-app-border dark:bg-app-card">
          {auth ? (
            <>
              <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                {auth.userEmail}
              </p>
              <div className="mt-2 grid gap-1 text-sm">
                <Link
                  to="/dashboard"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg px-2 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Dashboard
                </Link>
                <Link
                  to="/providers"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg px-2 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Connections
                </Link>
                <Link
                  to="/events"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg px-2 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  My Events
                </Link>
                <Link
                  to="/events/new"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg px-2 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Create Event
                </Link>
                <button
                  type="button"
                  onClick={() => void logout()}
                  disabled={isBusy}
                  className="mt-1 rounded-lg bg-brand-dark px-3 py-2 text-left text-brand-white transition hover:bg-[#111111] disabled:opacity-60 dark:bg-brand-white dark:text-brand-dark"
                >
                  {isBusy ? 'Logging out...' : 'Logout'}
                </button>
              </div>
            </>
          ) : (
            <div className="grid gap-2 text-sm">
              <p className="text-neutral-600 dark:text-neutral-300">Account access</p>
              <HeroCtaLink
                to="/auth/login"
                variant="lime"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="text-center"
              >
                Login
              </HeroCtaLink>
              <Link
                to="/auth/register"
                onClick={() => setIsOpen(false)}
                className="rounded-lg border border-app-border px-3 py-2 transition hover:border-brand-lime dark:border-app-border"
              >
                Create account
              </Link>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

const PlatformPreview = () => {
  const mobileShots = ['Guest Add Track', 'Magic Link View', 'Event Queue'];
  const tabletShots = ['Host Event List', 'Provider Connect', 'Track Moderation'];
  const desktopShots = ['Campaign Overview', 'Live Queue Control', 'Event Detail Analytics'];

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

const HomePage = () => (
  <div className="mx-auto grid w-full max-w-6xl gap-28 px-4 py-12 sm:gap-32 sm:px-6 sm:py-16 lg:gap-40 lg:px-8 lg:py-20">
    <div className="fixed left-4 top-4 z-20 sm:left-6 sm:top-6">
      <Link to="/" aria-label="Synqit home" className="inline-flex">
        <BrandLogo className="h-10 w-auto sm:h-20" />
      </Link>
    </div>
    <motion.section
      initial="hidden"
      animate="visible"
      variants={SECTION_REVEAL_VARIANTS}
      className="relative overflow-hidden rounded-4xl border border-app-border bg-app-elevated px-5 py-12 shadow-soft-lift dark:bg-app-card sm:px-8 sm:py-14 lg:px-12 lg:py-16"
    >
      <div className="pointer-events-none absolute -left-12 top-12 h-40 w-40 rounded-full bg-brand-pink/20 blur-2xl" />
      <div className="pointer-events-none absolute -right-14 -top-14 h-52 w-52 rounded-full bg-brand-lime/25 blur-3xl" />

      <div className="relative grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <div className="grid gap-7">
          <div className="flex flex-wrap items-center gap-2">
            <HeroPill variant="lime">Shared Playlist MVP</HeroPill>
            <HeroPill variant="pink">Magic Link Guest Flow</HeroPill>
          </div>
          <h1 className="max-w-4xl text-4xl font-black leading-tight tracking-tight text-brand-dark dark:text-brand-white sm:text-5xl lg:text-6xl">
            Collaborative event playlists, without forcing guests to sign up.
          </h1>
          <p className="max-w-2xl text-base text-neutral-700 dark:text-neutral-300 sm:text-lg">
            Synqit gives hosts a shareable link. Guests open it, search songs, and contribute in
            seconds while tracks land directly in the host provider playlist.
          </p>
          <div className="flex flex-wrap items-center gap-3.5">
            <HeroCtaLink to="/auth/register" variant="lime">
              Start as host
            </HeroCtaLink>
            <HeroCtaLink to="/auth/login" variant="outline">
              Login
            </HeroCtaLink>
          </div>
          <p className="text-xs text-app-text-muted sm:text-sm">
            Built for fast guest contribution on mobile, tablet, and desktop.
          </p>
        </div>

        <div className="grid gap-5 rounded-2xl border border-app-border bg-app-bg/80 p-4 backdrop-blur sm:p-5 dark:bg-app-elevated/70">
          <PlatformPreview />
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Quick share', 'Magic link'],
              ['Guest friction', 'Zero login'],
              ['Track routing', 'Host provider'],
              ['Setup time', '< 1 minute'],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-app-border bg-app-elevated px-3 py-2 dark:bg-app-card"
              >
                <p className="text-xs text-app-text-muted">{label}</p>
                <p className="text-sm font-semibold">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.section>

    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      variants={SECTION_REVEAL_VARIANTS}
      className="grid gap-7"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-2xl font-bold text-brand-dark dark:text-brand-white sm:text-3xl">
          Why hosts choose Synqit for event playlists
        </h2>
        <p className="max-w-2xl text-sm text-app-text-secondary sm:text-base">
          Structured for clarity and speed: create, share, collect tracks, moderate.
        </p>
      </div>
      <motion.div
        variants={GRID_STAGGER_VARIANTS}
        className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6"
      >
        {[
          { value: '1 link', label: 'Guest entry point' },
          { value: '< 30s', label: 'Typical guest add flow' },
          { value: '2 providers', label: 'Spotify + Apple Music' },
          { value: 'Host control', label: 'Edit, revoke, close' },
        ].map((item) => (
          <motion.article
            key={item.label}
            variants={GRID_ITEM_VARIANTS}
            className="rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card"
          >
            <p className="text-2xl font-black tracking-tight">{item.value}</p>
            <p className="mt-1 text-sm text-app-text-secondary">{item.label}</p>
          </motion.article>
        ))}
      </motion.div>
    </motion.section>

    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      variants={SECTION_REVEAL_VARIANTS}
      className="grid gap-7"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-2xl font-bold text-brand-dark dark:text-brand-white sm:text-3xl">
          How it works
        </h2>
        <HeroPill variant="lime">Mobile-first flow</HeroPill>
      </div>
      <motion.div variants={GRID_STAGGER_VARIANTS} className="grid gap-5 lg:grid-cols-3 lg:gap-6">
        {[
          {
            step: '01',
            title: 'Host sets up event',
            body: 'Connect provider, create the event playlist, and generate a magic link.',
          },
          {
            step: '02',
            title: 'Guests add tracks',
            body: 'Guests open the link and contribute songs from the host provider catalog.',
          },
          {
            step: '03',
            title: 'Host curates live',
            body: 'Host reviews tracks, removes items, and closes the event when ready.',
          },
        ].map((item) => (
          <motion.article
            key={item.step}
            variants={GRID_ITEM_VARIANTS}
            className="rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card"
          >
            <p className="text-xs font-black tracking-wider text-app-text-muted">{item.step}</p>
            <h3 className="mt-2 text-lg font-semibold">{item.title}</h3>
            <p className="mt-2 text-sm text-app-text-secondary">{item.body}</p>
          </motion.article>
        ))}
      </motion.div>
    </motion.section>

    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      variants={SECTION_REVEAL_VARIANTS}
      className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6"
    >
      {[
        {
          title: 'Host-first setup',
          body: 'Connect provider, create event, copy the magic link in under a minute.',
        },
        {
          title: 'Guest-friendly',
          body: 'Guests open the link, search tracks, and contribute without account creation.',
        },
        {
          title: 'Provider aligned',
          body: 'Tracks are searched against and added to the host provider account directly.',
        },
      ].map((item) => (
        <motion.article
          key={item.title}
          variants={GRID_ITEM_VARIANTS}
          className="rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:border-app-border dark:bg-app-card"
        >
          <h3 className="text-lg font-semibold">{item.title}</h3>
          <p className="mt-2 text-sm text-app-text-secondary">{item.body}</p>
        </motion.article>
      ))}
    </motion.section>

    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      variants={SECTION_REVEAL_VARIANTS}
      className="rounded-[2rem] border border-app-border bg-brand-gradient p-[1px] shadow-soft-lift"
    >
      <div className="rounded-[calc(2rem-1px)] bg-app-elevated px-5 py-10 dark:bg-app-card sm:px-8 sm:py-12">
        <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="grid gap-3">
            <HeroPill variant="pink">Ready to test your first event?</HeroPill>
            <h2 className="text-2xl font-bold text-brand-dark dark:text-brand-white sm:text-3xl">
              Launch a host event and start collecting tracks today.
            </h2>
            <p className="max-w-2xl text-sm text-app-text-secondary sm:text-base">
              Start with your own account, connect your provider, and share one link with guests.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <HeroCtaLink to="/auth/register" variant="lime">
              Create host account
            </HeroCtaLink>
            <HeroCtaLink to="/auth/login" variant="outline">
              I already have an account
            </HeroCtaLink>
          </div>
        </div>
      </div>
    </motion.section>
  </div>
);

const AppShell = () => {
  const auth = useMemo(() => loadAuth(), []);
  const [hasSession, setHasSession] = useState(Boolean(auth));
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const isPublicHome = pathname === '/';

  useEffect(() => {
    applyTheme(loadTheme());
  }, []);

  useEffect(() => {
    const onAuthChanged = () => setHasSession(isAuthenticated());
    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    window.addEventListener('storage', onAuthChanged);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
      window.removeEventListener('storage', onAuthChanged);
    };
  }, []);

  return (
    <div className="min-h-screen bg-app-bg text-app-text transition-colors">
      {isPublicHome ? (
        <>
          <div className="fixed right-4 top-4 z-30 flex items-center gap-2 sm:right-6 sm:top-6">
            <ThemeToggle />
            <AccountMenu />
          </div>
          <main>
            <Outlet />
          </main>
        </>
      ) : (
        <>
          <header className="sticky top-0 z-20 border-b border-app-border bg-app-elevated/90 backdrop-blur">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <Link to="/" className="inline-flex items-center">
                  <BrandLogo className="h-9 w-auto sm:h-10" />
                </Link>
                <nav className="hidden items-center gap-2 text-sm sm:flex">
                  <Link
                    to="/"
                    className="rounded-md px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Product
                  </Link>
                  {hasSession ? (
                    <>
                      <Link
                        to="/events"
                        className="rounded-md px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      >
                        Events
                      </Link>
                      <Link
                        to="/providers"
                        className="rounded-md px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      >
                        Providers
                      </Link>
                    </>
                  ) : null}
                </nav>
              </div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <AccountMenu />
              </div>
            </div>
          </header>
          <main>
            <Outlet />
          </main>
        </>
      )}
    </div>
  );
};

const AuthForm = ({
  endpoint,
  title,
}: {
  endpoint: '/v1/auth/register' | '/v1/auth/login';
  title: string;
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus('');

    try {
      const result = await callApi(
        endpoint,
        {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        },
        (payload) => payload,
      );

      const auth = storeAuth(result);
      setStatus(`Success. Logged in as ${auth.userEmail}.`);
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: '0.75rem', maxWidth: '24rem' }}>
      <h2>{title}</h2>
      <label>
        Email
        <input
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          style={{ width: '100%' }}
        />
      </label>
      <label>
        Password
        <input
          required
          minLength={8}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          style={{ width: '100%' }}
        />
      </label>
      <button disabled={isSubmitting} type="submit">
        {isSubmitting ? 'Submitting...' : title}
      </button>
      {status ? <p>{status}</p> : null}
    </form>
  );
};

const DashboardPage = () => {
  const [auth, setAuth] = useState<StoredAuth | null>(() => loadAuth());
  const [profile, setProfile] = useState<string>('No profile loaded.');
  const [isLoading, setIsLoading] = useState(false);

  const loadProfile = async () => {
    if (!auth) {
      setProfile('Not logged in.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await callApi(
        '/v1/me',
        {
          method: 'GET',
          headers: {
            authorization: `Bearer ${auth.accessToken}`,
          },
        },
        (payload) => authUserSchema.parse(payload),
      );
      setProfile(`User ID: ${user.id} | Email: ${user.email}`);
    } catch (error) {
      const apiError = toApiError(error);
      setProfile(`Error: ${apiError.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    if (!auth) {
      clearAuth();
      return;
    }

    const refreshPayload = refreshTokenRequestSchema.parse({
      refreshToken: auth.refreshToken,
    });

    await callApi(
      '/v1/auth/logout',
      {
        method: 'POST',
        body: JSON.stringify(refreshPayload),
      },
      (payload) => payload,
    ).catch(() => undefined);

    clearAuth();
    setAuth(null);
    setProfile('Logged out.');
  };

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <h2>Dashboard</h2>
      <p>{auth ? `Session: ${auth.userEmail}` : 'No active session.'}</p>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button disabled={isLoading} onClick={() => void loadProfile()} type="button">
          {isLoading ? 'Loading...' : 'Load profile'}
        </button>
        <button onClick={() => void logout()} type="button">
          Logout
        </button>
      </div>
      <p>{profile}</p>
    </div>
  );
};

const ProviderConnectionsPage = () => {
  const [status, setStatus] = useState<string>('Not loaded.');
  const [selectedProvider, setSelectedProvider] = useState<Provider>('spotify');
  const [integrationStatusByProvider, setIntegrationStatusByProvider] = useState<
    Partial<Record<Provider, 'connected' | 'not_connected'>>
  >({});
  const [oauthState, setOauthState] = useState<string>('');
  const [authUrl, setAuthUrl] = useState<string>('');
  const [isMockMode, setIsMockMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadIntegrationStatus = useCallback(async () => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus('Login required to manage provider connections.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await callApi(
        '/v1/integrations',
        {
          method: 'GET',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
        (payload) => integrationListResponseSchema.parse(payload),
      );

      const nextStatusByProvider: Partial<Record<Provider, 'connected' | 'not_connected'>> = {};
      for (const provider of providerSchema.options) {
        const current = result.integrations.find((item) => item.provider === provider);
        nextStatusByProvider[provider] = current?.status ?? 'not_connected';
      }
      setIntegrationStatusByProvider(nextStatusByProvider);

      const selectedStatus = result.integrations.find((item) => item.provider === selectedProvider);
      if (!selectedStatus || selectedStatus.status === 'not_connected') {
        setStatus(`${selectedProvider} is not connected.`);
      } else {
        setStatus(
          `${selectedProvider} connected. Expires at: ${selectedStatus.expiresAt ?? 'unknown'}`,
        );
      }
    } catch (error) {
      const detailedMessage =
        error instanceof Error
          ? error.message
          : typeof error === 'object'
            ? JSON.stringify(error)
            : String(error);
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message} (${detailedMessage})`);
    } finally {
      setIsLoading(false);
    }
  }, [selectedProvider]);

  const connectAppleMusic = async () => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus('Login required to connect Apple Music.');
      return;
    }

    setIsLoading(true);
    setOauthState('');
    setAuthUrl('');
    setIsMockMode(false);
    try {
      const tokenResponse = await callApi(
        '/v1/auth/apple/developer-token',
        {
          method: 'GET',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
        (payload) => {
          const value = payload as Partial<AppleDeveloperTokenResponse>;
          if (
            value &&
            value.provider === 'apple' &&
            typeof value.developerToken === 'string' &&
            typeof value.musicKitIdentifier === 'string'
          ) {
            return value as AppleDeveloperTokenResponse;
          }

          throw new Error('Invalid Apple developer token response.');
        },
      );

      await loadMusicKitScript();
      const musicKit = await ensureMusicKitInstance({
        developerToken: tokenResponse.developerToken,
        appName: tokenResponse.musicKitIdentifier || 'synqit',
      });

      const musicUserToken = await musicKit.authorize();
      if (!musicUserToken) {
        throw new Error('Apple Music did not return a user token.');
      }

      const result = await callApi(
        '/v1/auth/apple/connect',
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            musicUserToken,
          }),
        },
        (payload) => oauthCallbackResponseSchema.parse(payload),
      );
      setStatus(
        `${result.provider} connected at ${result.connectedAt}. Expires at: ${
          result.expiresAt ?? 'unknown'
        }`,
      );
      await loadIntegrationStatus();
    } catch (error) {
      const detailedMessage =
        error instanceof Error
          ? error.message
          : typeof error === 'object'
            ? JSON.stringify(error)
            : String(error);
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message} (${detailedMessage})`);
    } finally {
      setIsLoading(false);
    }
  };

  const startProviderConnect = async () => {
    if (selectedProvider === 'apple') {
      await connectAppleMusic();
      return;
    }

    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus('Login required to start provider connection.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await callApi(
        `/v1/auth/${selectedProvider}/start`,
        {
          method: 'GET',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
        (payload) => oauthStartResponseSchema.parse(payload),
      );

      setOauthState(result.state);
      setAuthUrl(result.authorizationUrl);
      const mockMode = result.authorizationUrl.includes(`/v1/auth/${selectedProvider}/callback?`);
      setIsMockMode(mockMode);
      setStatus(
        mockMode
          ? `${selectedProvider} connect started in mock mode. Use callback step to complete connection.`
          : `${selectedProvider} OAuth start created. Open authorization page, approve, then reload status.`,
      );
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const completeMockCallback = async () => {
    if (selectedProvider !== 'spotify') {
      setStatus('Mock callback is only used for Spotify fallback mode.');
      return;
    }

    if (!oauthState) {
      setStatus('Start OAuth first to generate state.');
      return;
    }

    setIsLoading(true);
    try {
      const query = new URLSearchParams({
        state: oauthState,
        code: 'demo-auth-code',
        response_mode: 'json',
      });
      const result = await callApi(
        `/v1/auth/${selectedProvider}/callback?${query.toString()}`,
        {
          method: 'GET',
        },
        (payload) => oauthCallbackResponseSchema.parse(payload),
      );
      setStatus(
        `${result.provider} connected at ${result.connectedAt}. Expires at: ${
          result.expiresAt ?? 'unknown'
        }`,
      );
      setOauthState('');
      await loadIntegrationStatus();
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const providerParam = params.get('provider');
    if (
      providerParam &&
      providerSchema.options.includes(providerParam as Provider) &&
      params.get('status') === 'connected'
    ) {
      setSelectedProvider(providerParam as Provider);
      setStatus(`${providerParam} OAuth completed. Loading latest connection state...`);
      void loadIntegrationStatus();
      params.delete('provider');
      params.delete('status');
      const nextQuery = params.toString();
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`,
      );
    }
  }, [loadIntegrationStatus]);

  const disconnectProvider = async () => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus('Login required to disconnect provider.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await callApi(
        `/v1/auth/${selectedProvider}/disconnect`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
        (payload) => integrationDisconnectResponseSchema.parse(payload),
      );
      setStatus(
        result.disconnected
          ? `${selectedProvider} disconnected.`
          : `${selectedProvider} was already disconnected.`,
      );
      await loadIntegrationStatus();
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <h2>Provider Connections</h2>
      <label>
        Provider
        <select
          value={selectedProvider}
          onChange={(event) => {
            setSelectedProvider(event.target.value as Provider);
            setOauthState('');
            setAuthUrl('');
            setIsMockMode(false);
          }}
          style={{ marginLeft: '0.5rem' }}
        >
          {providerSchema.options.map((provider) => (
            <option key={provider} value={provider}>
              {provider}
            </option>
          ))}
        </select>
      </label>
      <p>{status}</p>
      <p>
        Status snapshot:{' '}
        {providerSchema.options
          .map((provider) => `${provider}: ${integrationStatusByProvider[provider] ?? 'unknown'}`)
          .join(' | ')}
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button disabled={isLoading} onClick={() => void loadIntegrationStatus()} type="button">
          {isLoading ? 'Loading...' : 'Load status'}
        </button>
        <button disabled={isLoading} onClick={() => void startProviderConnect()} type="button">
          {selectedProvider === 'apple' ? 'Connect Apple Music' : `Start ${selectedProvider} OAuth`}
        </button>
        {isMockMode && selectedProvider === 'spotify' ? (
          <button disabled={isLoading} onClick={() => void completeMockCallback()} type="button">
            Complete Callback (Mock)
          </button>
        ) : null}
        <button disabled={isLoading} onClick={() => void disconnectProvider()} type="button">
          Disconnect {selectedProvider}
        </button>
      </div>
      {authUrl ? (
        <p>
          {selectedProvider} authorize URL:{' '}
          <a href={authUrl} rel="noreferrer" target="_blank">
            Open authorization page
          </a>
        </p>
      ) : null}
      <p>Supported providers in v1: {providerSchema.options.join(', ')}</p>
    </div>
  );
};

const EventCreatePage = () => {
  const [provider, setProvider] = useState<Provider>('spotify');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('Create an event to generate a magic link.');
  const [magicLinkUrl, setMagicLinkUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const createEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus('Login required to create events.');
      return;
    }

    setIsLoading(true);
    setMagicLinkUrl('');
    try {
      const result = await callApi(
        '/v1/events',
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            provider,
            name,
            description,
          }),
        },
        (payload) => eventResponseSchema.parse(payload),
      );

      setStatus(`Event "${result.event.name}" created.`);
      setMagicLinkUrl(result.magicLinkUrl);
      setName('');
      setDescription('');
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '0.75rem', maxWidth: '36rem' }}>
      <h2>Create Event Playlist</h2>
      <form onSubmit={createEvent} style={{ display: 'grid', gap: '0.75rem' }}>
        <label>
          Provider
          <select
            value={provider}
            onChange={(event) => setProvider(event.target.value as Provider)}
            style={{ marginLeft: '0.5rem' }}
          >
            {providerSchema.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label>
          Event name
          <input
            required
            maxLength={100}
            value={name}
            onChange={(nextEvent) => setName(nextEvent.target.value)}
            style={{ width: '100%' }}
          />
        </label>
        <label>
          Description
          <textarea
            maxLength={500}
            value={description}
            onChange={(nextEvent) => setDescription(nextEvent.target.value)}
            style={{ width: '100%', minHeight: '5rem' }}
          />
        </label>
        <button disabled={isLoading} type="submit">
          {isLoading ? 'Creating...' : 'Create event'}
        </button>
      </form>
      <p>{status}</p>
      {magicLinkUrl ? (
        <p>
          Magic link: <a href={magicLinkUrl}>{magicLinkUrl}</a>
        </p>
      ) : null}
    </div>
  );
};

const HostEventsPage = () => {
  const [status, setStatus] = useState('Load your events.');
  const [events, setEvents] = useState<
    Array<{
      id: string;
      name: string;
      description: string;
      status: 'open' | 'closed';
      magicLinkToken: string;
      magicLinkRevokedAt: string | null;
      updatedAt: string;
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [actionEventId, setActionEventId] = useState<string | null>(null);
  const [expandedTracksEventId, setExpandedTracksEventId] = useState<string | null>(null);
  const [tracksByEventId, setTracksByEventId] = useState<
    Record<
      string,
      Array<{
        providerTrackId: string;
        name: string;
        artist: string;
        album: string;
        durationMs: number;
        artworkUrl: string | null;
        addedAt: string;
        addedBy: string;
      }>
    >
  >({});
  const [loadingTracksEventId, setLoadingTracksEventId] = useState<string | null>(null);
  const [trackActionKey, setTrackActionKey] = useState<string | null>(null);

  const loadEvents = async () => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus('Login required to view events.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await callApi(
        '/v1/events',
        {
          method: 'GET',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
        (payload) => eventListResponseSchema.parse(payload),
      );

      setEvents(
        result.events.map((event) => ({
          id: event.id,
          name: event.name,
          description: event.description,
          status: event.status,
          magicLinkToken: event.magicLinkToken,
          magicLinkRevokedAt: event.magicLinkRevokedAt,
          updatedAt: event.updatedAt,
        })),
      );
      setStatus(`Loaded ${result.events.length} events.`);
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const startEdit = (event: { id: string; name: string; description: string }) => {
    setEditingEventId(event.id);
    setEditName(event.name);
    setEditDescription(event.description);
  };

  const cancelEdit = () => {
    setEditingEventId(null);
    setEditName('');
    setEditDescription('');
  };

  const saveEvent = async (eventId: string) => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus('Login required to update events.');
      return;
    }

    setActionEventId(eventId);
    try {
      const payload = updateEventRequestSchema.parse({
        name: editName,
        description: editDescription,
      });

      const result = await callApi(
        `/v1/events/${encodeURIComponent(eventId)}`,
        {
          method: 'PATCH',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        },
        (responsePayload) => eventResponseSchema.parse(responsePayload),
      );

      setEvents((previousEvents) =>
        previousEvents.map((event) =>
          event.id === eventId
            ? {
                ...event,
                name: result.event.name,
                description: result.event.description,
                status: result.event.status,
                updatedAt: result.event.updatedAt,
              }
            : event,
        ),
      );
      setStatus(`Updated "${result.event.name}".`);
      cancelEdit();
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message}`);
    } finally {
      setActionEventId(null);
    }
  };

  const closeEvent = async (eventId: string) => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus('Login required to close events.');
      return;
    }

    setActionEventId(eventId);
    try {
      const result = await callApi(
        `/v1/events/${encodeURIComponent(eventId)}/close`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
        (responsePayload) => eventResponseSchema.parse(responsePayload),
      );

      setEvents((previousEvents) =>
        previousEvents.map((event) =>
          event.id === eventId
            ? {
                ...event,
                status: result.event.status,
                updatedAt: result.event.updatedAt,
              }
            : event,
        ),
      );
      setStatus(`Closed "${result.event.name}".`);
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message}`);
    } finally {
      setActionEventId(null);
    }
  };

  const revokeMagicLink = async (eventId: string) => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus('Login required to revoke links.');
      return;
    }

    setActionEventId(eventId);
    try {
      const result = await callApi(
        `/v1/events/${encodeURIComponent(eventId)}/magic-link/revoke`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
        (responsePayload) => eventResponseSchema.parse(responsePayload),
      );

      setEvents((previousEvents) =>
        previousEvents.map((event) =>
          event.id === eventId
            ? {
                ...event,
                magicLinkToken: result.event.magicLinkToken,
                magicLinkRevokedAt: result.event.magicLinkRevokedAt,
                updatedAt: result.event.updatedAt,
              }
            : event,
        ),
      );
      setStatus(`Revoked magic link for "${result.event.name}".`);
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message}`);
    } finally {
      setActionEventId(null);
    }
  };

  const regenerateMagicLink = async (eventId: string) => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus('Login required to regenerate links.');
      return;
    }

    setActionEventId(eventId);
    try {
      const result = await callApi(
        `/v1/events/${encodeURIComponent(eventId)}/magic-link/regenerate`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
        (responsePayload) => eventResponseSchema.parse(responsePayload),
      );

      setEvents((previousEvents) =>
        previousEvents.map((event) =>
          event.id === eventId
            ? {
                ...event,
                magicLinkToken: result.event.magicLinkToken,
                magicLinkRevokedAt: result.event.magicLinkRevokedAt,
                updatedAt: result.event.updatedAt,
              }
            : event,
        ),
      );
      setStatus(`Generated new magic link for "${result.event.name}".`);
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message}`);
    } finally {
      setActionEventId(null);
    }
  };

  const loadTracksForEvent = async (eventId: string) => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus('Login required to view event tracks.');
      return;
    }

    setLoadingTracksEventId(eventId);
    try {
      const result = await callApi(
        `/v1/events/${encodeURIComponent(eventId)}/tracks`,
        {
          method: 'GET',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
        (responsePayload) => eventTracksResponseSchema.parse(responsePayload),
      );

      setTracksByEventId((previousTracks) => ({
        ...previousTracks,
        [eventId]: result.tracks,
      }));
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message}`);
    } finally {
      setLoadingTracksEventId(null);
    }
  };

  const toggleTracks = async (eventId: string) => {
    if (expandedTracksEventId === eventId) {
      setExpandedTracksEventId(null);
      return;
    }

    setExpandedTracksEventId(eventId);
    if (!tracksByEventId[eventId]) {
      await loadTracksForEvent(eventId);
    }
  };

  const removeTrack = async (eventId: string, providerTrackId: string) => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus('Login required to remove tracks.');
      return;
    }

    const actionKey = `${eventId}:${providerTrackId}`;
    setTrackActionKey(actionKey);
    try {
      await callApi(
        `/v1/events/${encodeURIComponent(eventId)}/tracks/${encodeURIComponent(providerTrackId)}`,
        {
          method: 'DELETE',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
        (responsePayload) => removeEventTrackResponseSchema.parse(responsePayload),
      );

      setTracksByEventId((previousTracks) => ({
        ...previousTracks,
        [eventId]: (previousTracks[eventId] ?? []).filter(
          (track) => track.providerTrackId !== providerTrackId,
        ),
      }));
      setStatus('Track removed.');
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message}`);
    } finally {
      setTrackActionKey(null);
    }
  };

  const deleteEvent = async (eventId: string) => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus('Login required to delete events.');
      return;
    }

    if (!window.confirm('Delete this event? This only removes it from Synqit for now.')) {
      return;
    }

    setActionEventId(eventId);
    try {
      const result = await callApi(
        `/v1/events/${encodeURIComponent(eventId)}`,
        {
          method: 'DELETE',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
        (responsePayload) => deleteEventResponseSchema.parse(responsePayload),
      );

      setEvents((previousEvents) => previousEvents.filter((event) => event.id !== result.eventId));
      setStatus('Event deleted.');
      if (editingEventId === result.eventId) {
        cancelEdit();
      }
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message}`);
    } finally {
      setActionEventId(null);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <h2>My Events</h2>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button disabled={isLoading} onClick={() => void loadEvents()} type="button">
          {isLoading ? 'Loading...' : 'Load events'}
        </button>
        <Link to="/events/new">Create new event</Link>
      </div>
      <p>{status}</p>
      {events.length > 0 ? (
        <ul>
          {events.map((event) => (
            <li key={event.id} style={{ marginBottom: '0.75rem' }}>
              {editingEventId === event.id ? (
                <form
                  onSubmit={(submitEvent) => {
                    submitEvent.preventDefault();
                    void saveEvent(event.id);
                  }}
                  style={{ display: 'grid', gap: '0.5rem', maxWidth: '38rem' }}
                >
                  <label>
                    Event name
                    <input
                      required
                      maxLength={100}
                      value={editName}
                      onChange={(nextEvent) => setEditName(nextEvent.target.value)}
                      style={{ width: '100%' }}
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      maxLength={500}
                      value={editDescription}
                      onChange={(nextEvent) => setEditDescription(nextEvent.target.value)}
                      style={{ width: '100%', minHeight: '4rem' }}
                    />
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button disabled={actionEventId === event.id} type="submit">
                      {actionEventId === event.id ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      disabled={actionEventId === event.id}
                      onClick={() => cancelEdit()}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div style={{ display: 'grid', gap: '0.25rem' }}>
                  <strong>{event.name}</strong>
                  <span>{event.description || 'No description provided.'}</span>
                  <span>Status: {event.status}</span>
                  <span>
                    Guest link:{' '}
                    {event.magicLinkRevokedAt ? (
                      'Revoked'
                    ) : (
                      <a href={`${window.location.origin}/event/${event.magicLinkToken}`}>
                        {`${window.location.origin}/event/${event.magicLinkToken}`}
                      </a>
                    )}
                  </span>
                  <span>Last updated: {new Date(event.updatedAt).toLocaleString()}</span>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      disabled={actionEventId === event.id}
                      onClick={() => startEdit(event)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      disabled={actionEventId === event.id || event.status !== 'open'}
                      onClick={() => void closeEvent(event.id)}
                      type="button"
                    >
                      {actionEventId === event.id ? 'Working...' : 'Close'}
                    </button>
                    <button
                      disabled={actionEventId === event.id}
                      onClick={() => void deleteEvent(event.id)}
                      type="button"
                    >
                      {actionEventId === event.id ? 'Working...' : 'Delete'}
                    </button>
                    <button
                      disabled={actionEventId === event.id || Boolean(event.magicLinkRevokedAt)}
                      onClick={() => void revokeMagicLink(event.id)}
                      type="button"
                    >
                      {actionEventId === event.id ? 'Working...' : 'Revoke Link'}
                    </button>
                    <button
                      disabled={actionEventId === event.id}
                      onClick={() => void regenerateMagicLink(event.id)}
                      type="button"
                    >
                      {actionEventId === event.id ? 'Working...' : 'Regenerate Link'}
                    </button>
                    <button
                      disabled={loadingTracksEventId === event.id}
                      onClick={() => void toggleTracks(event.id)}
                      type="button"
                    >
                      {expandedTracksEventId === event.id ? 'Hide Tracks' : 'Manage Tracks'}
                    </button>
                  </div>
                  {expandedTracksEventId === event.id ? (
                    <div style={{ marginTop: '0.5rem' }}>
                      <p style={{ margin: 0 }}>Tracks ({tracksByEventId[event.id]?.length ?? 0})</p>
                      {loadingTracksEventId === event.id ? <p>Loading tracks...</p> : null}
                      {(tracksByEventId[event.id] ?? []).length > 0 ? (
                        <ul>
                          {(tracksByEventId[event.id] ?? []).map((track) => {
                            const nextActionKey = `${event.id}:${track.providerTrackId}`;
                            return (
                              <li key={track.providerTrackId} style={{ marginBottom: '0.25rem' }}>
                                {track.name} - {track.artist}
                                {' · '}
                                <button
                                  disabled={trackActionKey === nextActionKey}
                                  onClick={() => void removeTrack(event.id, track.providerTrackId)}
                                  type="button"
                                >
                                  {trackActionKey === nextActionKey ? 'Removing...' : 'Remove'}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      ) : loadingTracksEventId !== event.id ? (
                        <p>No tracks in this event yet.</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

const EventPublicPage = () => {
  const params = useParams({ from: '/event/$magicLinkToken' });
  const [status, setStatus] = useState('Loading event...');
  const [eventName, setEventName] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventState, setEventState] = useState('');
  const [tracks, setTracks] = useState<
    Array<{
      providerTrackId: string;
      name: string;
      artist: string;
      album: string;
      durationMs: number;
      artworkUrl: string | null;
      addedAt: string;
      addedBy: string;
    }>
  >([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchStatus, setSearchStatus] = useState('Search tracks and add to this event playlist.');
  const [searchResults, setSearchResults] = useState<
    Array<{
      providerTrackId: string;
      name: string;
      artist: string;
      album: string;
      durationMs: number;
      artworkUrl: string | null;
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [addingTrackId, setAddingTrackId] = useState<string | null>(null);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);

  const loadTracks = useCallback(async () => {
    setIsLoadingTracks(true);
    try {
      const result = await callApi(
        `/v1/events/link/${encodeURIComponent(params.magicLinkToken)}/tracks`,
        {
          method: 'GET',
        },
        (payload) => eventTracksResponseSchema.parse(payload),
      );
      setTracks(result.tracks);
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message}`);
    } finally {
      setIsLoadingTracks(false);
    }
  }, [params.magicLinkToken]);

  useEffect(() => {
    const loadEventAndTracks = async () => {
      setIsLoading(true);
      try {
        const [eventResult, tracksResult] = await Promise.all([
          callApi(
            `/v1/events/link/${encodeURIComponent(params.magicLinkToken)}`,
            {
              method: 'GET',
            },
            (payload) => eventPublicResponseSchema.parse(payload),
          ),
          callApi(
            `/v1/events/link/${encodeURIComponent(params.magicLinkToken)}/tracks`,
            {
              method: 'GET',
            },
            (payload) => eventTracksResponseSchema.parse(payload),
          ),
        ]);

        setEventName(eventResult.event.name);
        setEventDescription(eventResult.event.description);
        setEventState(eventResult.event.status);
        setTracks(tracksResult.tracks);
        setStatus('Event loaded.');
      } catch (error) {
        const apiError = toApiError(error);
        setStatus(`Error: ${apiError.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    void loadEventAndTracks();
  }, [params.magicLinkToken]);

  const onSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (eventState !== 'open') {
      setSearchStatus('This event is closed. New tracks cannot be added.');
      return;
    }

    const nextQuery = searchQuery.trim();
    if (nextQuery.length < 2) {
      setSearchStatus('Type at least 2 characters.');
      return;
    }

    setIsSearching(true);
    try {
      const query = new URLSearchParams({ q: nextQuery });
      const result = await callApi(
        `/v1/events/link/${encodeURIComponent(params.magicLinkToken)}/search?${query.toString()}`,
        {
          method: 'GET',
        },
        (payload) => eventTrackSearchResponseSchema.parse(payload),
      );
      setSearchResults(result.results);
      setSearchStatus(`Found ${result.results.length} track(s).`);
    } catch (error) {
      const apiError = toApiError(error);
      setSearchStatus(`Error: ${apiError.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const addTrack = async (track: {
    providerTrackId: string;
    name: string;
    artist: string;
    album: string;
    durationMs: number;
    artworkUrl: string | null;
  }) => {
    if (eventState !== 'open') {
      setSearchStatus('This event is closed. New tracks cannot be added.');
      return;
    }

    setAddingTrackId(track.providerTrackId);
    try {
      const result = await callApi(
        `/v1/events/link/${encodeURIComponent(params.magicLinkToken)}/tracks`,
        {
          method: 'POST',
          body: JSON.stringify(track),
        },
        (payload) => addEventTrackResponseSchema.parse(payload),
      );
      setTracks((previousTracks) => [
        result.track,
        ...previousTracks.filter(
          (existingTrack) => existingTrack.providerTrackId !== result.track.providerTrackId,
        ),
      ]);
      setSearchStatus(`Added "${result.track.name}" to the event playlist.`);
    } catch (error) {
      const apiError = toApiError(error);
      setSearchStatus(`Error: ${apiError.message}`);
    } finally {
      setAddingTrackId(null);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '0.75rem', maxWidth: '42rem' }}>
      <h2>Event Playlist</h2>
      <p>{status}</p>
      {eventName ? (
        <>
          <p>
            <strong>{eventName}</strong>
          </p>
          <p>{eventDescription || 'No description provided.'}</p>
          <p>Status: {eventState}</p>
          <form onSubmit={onSearch} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              placeholder="Search songs or artists"
              value={searchQuery}
              onChange={(nextEvent) => setSearchQuery(nextEvent.target.value)}
              minLength={2}
              maxLength={120}
              style={{ flex: 1, minWidth: '16rem' }}
            />
            <button disabled={isSearching || isLoading || eventState !== 'open'} type="submit">
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </form>
          <p>{searchStatus}</p>
          {searchResults.length > 0 ? (
            <ul>
              {searchResults.map((track) => (
                <li key={track.providerTrackId} style={{ marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {track.artworkUrl ? (
                      <img
                        src={track.artworkUrl}
                        alt=""
                        width={48}
                        height={48}
                        style={{ borderRadius: '0.25rem' }}
                      />
                    ) : null}
                    <div style={{ flex: 1 }}>
                      <strong>{track.name}</strong> - {track.artist}
                      <br />
                      <small>
                        {track.album} • {Math.round(track.durationMs / 1000)}s
                      </small>
                    </div>
                    <button
                      disabled={addingTrackId === track.providerTrackId || eventState !== 'open'}
                      onClick={() => void addTrack(track)}
                      type="button"
                    >
                      {addingTrackId === track.providerTrackId ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h3 style={{ margin: 0 }}>Current Tracks ({tracks.length})</h3>
            <button disabled={isLoadingTracks} onClick={() => void loadTracks()} type="button">
              {isLoadingTracks ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          {tracks.length > 0 ? (
            <ul>
              {tracks.map((track) => (
                <li key={`${track.providerTrackId}-${track.addedAt}`}>
                  {track.name} - {track.artist} ({track.album})
                </li>
              ))}
            </ul>
          ) : (
            <p>No tracks yet.</p>
          )}
        </>
      ) : null}
    </div>
  );
};

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
  component: () => <AuthForm endpoint="/v1/auth/register" title="Register" />,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/login',
  beforeLoad: redirectIfAuthenticated,
  component: () => <AuthForm endpoint="/v1/auth/login" title="Login" />,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  beforeLoad: requireAuth,
  component: DashboardPage,
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
]);
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
