import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { PublicMobileNav } from '../../components/PublicMobileNav';
import { PublicNav } from '../../components/PublicNav';
import { ThemeToggle } from '../../components/ThemeToggle';

const LANGUAGES = [
  { locale: 'en', iconSrc: '/en.png', iconAlt: 'US flag', name: 'English' },
  { locale: 'fr', iconSrc: '/fr.png', iconAlt: 'French flag', name: 'French' },
] as const;

/** jsdom has no layout: hand each element the rect its test needs. */
const stubRect = (element: Element, rect: Partial<DOMRect>) => {
  element.getBoundingClientRect = () =>
    ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, ...rect }) as DOMRect;
};

describe('PublicNav', () => {
  it('marks the active item with aria-current', () => {
    render(
      <PublicNav
        ariaLabel="Main"
        activeId="pricing"
        items={[
          { id: 'home', href: '/', label: 'Home' },
          { id: 'pricing', href: '/pricing', label: 'Pricing' },
        ]}
      />,
    );
    expect(screen.getByRole('link', { name: 'Pricing' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });
});

describe('LanguageSwitcher', () => {
  it('opens the list and reports the chosen locale', async () => {
    const onChange = vi.fn();
    render(
      <LanguageSwitcher
        value="en"
        onChange={onChange}
        openLabel="Select language"
        selectLabel={(name) => `Switch to ${name}`}
        options={[
          { locale: 'en', iconSrc: '/en.png', iconAlt: 'US flag', name: 'English' },
          { locale: 'fr', iconSrc: '/fr.png', iconAlt: 'French flag', name: 'French' },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Select language' }));
    await userEvent.click(screen.getByRole('option', { name: 'Switch to French' }));
    expect(onChange).toHaveBeenCalledWith('fr');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('opens upwards when the floating mobile dock covers the space below', async () => {
    render(
      <>
        <LanguageSwitcher
          value="en"
          onChange={vi.fn()}
          openLabel="Select language"
          options={LANGUAGES}
        />
        <PublicMobileNav
          ariaLabel="Mobile navigation"
          activeId="home"
          items={[{ id: 'home', href: '/', label: 'Home', icon: null }]}
        />
      </>,
    );

    // Trigger sits 114px above the viewport bottom; the dock eats the last 76px,
    // so the 92px menu does not fit underneath it.
    window.innerHeight = 812;
    stubRect(screen.getByRole('button', { name: 'Select language' }).parentElement!, {
      top: 662,
      bottom: 698,
      left: 170,
      right: 206,
      width: 36,
    });
    stubRect(screen.getByRole('navigation', { name: 'Mobile navigation' }), {
      top: 736,
      bottom: 796,
      width: 240,
      height: 60,
    });

    await userEvent.click(screen.getByRole('button', { name: 'Select language' }));
    const listbox = screen.getByRole('listbox');
    stubRect(listbox, { width: 60, height: 92 });
    fireEvent.resize(window);

    expect(listbox).toHaveClass('bottom-full');
    expect(listbox).not.toHaveClass('top-full');
    expect(listbox).not.toHaveClass('invisible');
  });
});

describe('ThemeToggle', () => {
  it('reflects state and calls back on click', async () => {
    const onToggle = vi.fn();
    render(<ThemeToggle isDark onToggle={onToggle} label="Theme" />);
    const button = screen.getByRole('button', { name: 'Theme' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
