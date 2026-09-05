import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { AccordionSection } from '../../components/AccordionSection';
import { PasswordField } from '../../components/PasswordField';
import { PasswordStrengthMeter } from '../../components/PasswordStrengthMeter';

const labels = {
  strength: 'Strength',
  weak: 'Weak',
  fair: 'Fair',
  good: 'Good',
  strong: 'Strong',
  criteriaTitle: 'Requirements',
  criteriaLength: '8+ characters',
  criteriaCase: 'Upper and lower case',
  criteriaNumber: 'A number',
  criteriaSpecial: 'A symbol',
  tooltip: 'Show requirements',
  close: 'Close',
};

const ControlledPassword = () => {
  const [value, setValue] = useState('');
  return (
    <PasswordField
      value={value}
      onChange={setValue}
      showPasswordLabel="Show password"
      hidePasswordLabel="Hide password"
      placeholder="Password"
    />
  );
};

describe('PasswordField', () => {
  it('toggles between masked and visible input', async () => {
    render(<ControlledPassword />);
    const input = screen.getByPlaceholderText('Password');
    expect(input).toHaveAttribute('type', 'password');

    await userEvent.type(input, 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveValue('secret');
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();
  });
});

describe('PasswordStrengthMeter', () => {
  it('labels weak and strong passwords', () => {
    const { rerender } = render(<PasswordStrengthMeter password="abc" labels={labels} />);
    expect(screen.getByText('Weak')).toBeInTheDocument();

    rerender(<PasswordStrengthMeter password="Str0ng!Passw0rd" labels={labels} />);
    expect(screen.getByText('Strong')).toBeInTheDocument();
  });
});

describe('AccordionSection', () => {
  it('hides content until expanded', async () => {
    render(
      <AccordionSection title="Advanced">
        <p>hidden content</p>
      </AccordionSection>,
    );
    const toggle = screen.getByRole('button', { name: 'Advanced' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('hidden content')).not.toBeInTheDocument();

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('hidden content')).toBeInTheDocument();
  });
});
