import type { Story } from '@ladle/react';
import { Home, LogIn, Tag } from 'lucide-react';
import { useState } from 'react';

import { BrandLogo } from '../components/BrandLogo';
import { CircularImage } from '../components/CircularImage';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { NotificationDot } from '../components/NotificationDot';
import { PublicMobileNav } from '../components/PublicMobileNav';
import { PublicNav } from '../components/PublicNav';
import { RouteLoadingScreen } from '../components/RouteLoadingScreen';
import { ThemeToggle } from '../components/ThemeToggle';

export const Nav: Story = () => {
  const [active, setActive] = useState('home');
  const items = [
    { id: 'home', href: '#home', label: 'Home' },
    { id: 'pricing', href: '#pricing', label: 'Pricing' },
    { id: 'login', href: '#login', label: 'Log in' },
  ];
  return (
    <div className="grid gap-6">
      <PublicNav items={items} activeId={active} onActivate={setActive} ariaLabel="Main" />
      <PublicMobileNav
        ariaLabel="Main"
        activeId={active}
        onActivate={setActive}
        items={[
          { id: 'home', href: '#home', label: 'Home', icon: <Home size={18} aria-hidden="true" /> },
          {
            id: 'pricing',
            href: '#pricing',
            label: 'Pricing',
            icon: <Tag size={18} aria-hidden="true" />,
          },
          {
            id: 'login',
            href: '#login',
            label: 'Log in',
            icon: <LogIn size={18} aria-hidden="true" />,
          },
        ]}
      />
      <p className="text-xs text-app-text-secondary">Mobile bar is fixed at the bottom below md.</p>
    </div>
  );
};

export const Toggles: Story = () => {
  const [isDark, setIsDark] = useState(false);
  const [locale, setLocale] = useState<'en' | 'fr'>('en');
  return (
    <div className="flex items-center gap-6">
      <ThemeToggle isDark={isDark} onToggle={() => setIsDark((value) => !value)} />
      <ThemeToggle
        isDark={isDark}
        onToggle={() => setIsDark((value) => !value)}
        variant="translucent"
      />
      <LanguageSwitcher
        value={locale}
        onChange={setLocale}
        openLabel="Select language"
        selectLabel={(name) => `Switch to ${name}`}
        options={[
          {
            locale: 'en',
            iconSrc: '/assets/flags/USA.png',
            iconAlt: 'United States flag',
            name: 'English',
          },
          {
            locale: 'fr',
            iconSrc: '/assets/flags/FR.png',
            iconAlt: 'French flag',
            name: 'Français',
          },
        ]}
      />
      <span className="relative inline-flex">
        <CircularImage src="/assets/logos/logo-full.png" alt="Avatar" />
        <NotificationDot className="absolute -right-0.5 -top-0.5" />
      </span>
      <BrandLogo />
    </div>
  );
};

export const Loader: Story = () => <RouteLoadingScreen />;
