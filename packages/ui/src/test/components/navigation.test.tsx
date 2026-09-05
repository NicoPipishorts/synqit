import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { PublicNav } from '../../components/PublicNav';
import { ThemeToggle } from '../../components/ThemeToggle';

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
