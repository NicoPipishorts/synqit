// Design tokens live in ./tokens.css — import "@synqit/ui/tokens.css" from your app stylesheet.

export { cn } from './utils/cn';

// Layout & surfaces
export { SurfaceCard } from './components/SurfaceCard';
export { EmptyState } from './components/EmptyState';
export { OnboardingPanel, type OnboardingStep } from './components/OnboardingPanel';
export { StatCard, StatGrid, type StatCardProps, type StatItem } from './components/StatCard';
export { DataTable, type DataTableColumn, type DataTableProps } from './components/DataTable';

// Actions
export {
  CTAAnchor,
  CTAButton,
  CTAMobileIconLabel,
  ctaClassName,
  type CTAAnchorProps,
  type CTAButtonProps,
  type CtaSize,
  type CtaVariant,
} from './components/cta';
export { IconButton, type IconButtonProps } from './components/IconButton';

// Overlays & feedback
export { Modal, type ModalProps } from './components/Modal';
export { SlideOverPanel } from './components/SlideOverPanel';
export { AccordionSection } from './components/AccordionSection';
export { ToastProvider } from './components/ToastProvider';
export {
  ToastContext,
  useToast,
  type ToastContextValue,
  type ToastOptions,
  type ToastVariant,
} from './hooks/useToast';
export { NotificationDot } from './components/NotificationDot';
export { Tooltip } from './components/Tooltip';
export { RouteLoadingScreen } from './components/RouteLoadingScreen';

// Forms
export { PasswordField, type PasswordFieldProps } from './components/PasswordField';
export {
  PasswordStrengthMeter,
  type PasswordStrengthLabels,
  type PasswordStrengthMeterProps,
} from './components/PasswordStrengthMeter';

// Navigation & brand
export { BrandLogo } from './components/BrandLogo';
export {
  CONNECT_SERVICES,
  getServiceMarkSrc,
  isMonochromeServiceMark,
  LINK_SERVICES,
  MUSIC_SERVICES,
  ServiceChip,
  ServiceLogo,
  type MusicService,
  type MusicServiceAccess,
  type MusicServiceId,
  type ServiceChipProps,
  type ServiceLogoProps,
} from './components/ServiceLogo';
export { ThemeToggle, type ThemeToggleVariant } from './components/ThemeToggle';
export { LanguageSwitcher, type LanguageOption } from './components/LanguageSwitcher';
export { PublicNav, type PublicNavItem } from './components/PublicNav';
export { NAV_BAR_CLASS, NAV_ITEM_CLASS } from './components/nav-classes';
export { PublicMobileNav, type PublicMobileNavItem } from './components/PublicMobileNav';

// Decoration
export { Highlight } from './components/Highlight';
export { Sticker, type StickerProps, type StickerTone } from './components/Sticker';
export { CircularImage } from './components/CircularImage';
export { DotPatternOverlay } from './components/DotPatternOverlay';
export { PageBackdrop } from './components/PageBackdrop';
export { TapeStrip, type TapeTone } from './components/TapeStrip';
