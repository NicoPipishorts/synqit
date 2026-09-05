import type { Story } from '@ladle/react';
import { useState } from 'react';

import { PasswordField } from '../components/PasswordField';
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter';

const labels = {
  strength: 'Password strength',
  weak: 'Weak',
  fair: 'Fair',
  good: 'Good',
  strong: 'Strong',
  criteriaTitle: 'Your password needs',
  criteriaLength: 'At least 8 characters',
  criteriaCase: 'Upper and lower case letters',
  criteriaNumber: 'At least one number',
  criteriaSpecial: 'At least one symbol',
  tooltip: 'Show password requirements',
  close: 'Close',
};

export const PasswordWithMeter: Story = () => {
  const [value, setValue] = useState('');
  return (
    <div className="grid max-w-sm gap-3">
      <PasswordField
        value={value}
        onChange={setValue}
        placeholder="Choose a password"
        showPasswordLabel="Show password"
        hidePasswordLabel="Hide password"
        autoComplete="new-password"
      />
      <PasswordStrengthMeter password={value} labels={labels} showTooltip />
    </div>
  );
};
