import { Eye, EyeOff } from 'lucide-react';
import { useId, useState } from 'react';

import { useI18n } from '../../hooks/useI18n';

type PasswordFieldProps = {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  id?: string;
};

const DEFAULT_INPUT_CLASS_NAME =
  'w-full rounded-xl border border-app-border bg-app-bg px-3 py-2.5 pr-10 text-app-text outline-none transition focus:border-brand-pink';

export const PasswordField = ({
  value,
  onChange,
  placeholder,
  autoComplete,
  required = false,
  minLength,
  disabled = false,
  className,
  inputClassName = DEFAULT_INPUT_CLASS_NAME,
  id,
}: PasswordFieldProps) => {
  const { t } = useI18n();
  const [isVisible, setIsVisible] = useState(false);
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className={className ? `relative ${className}` : 'relative'}>
      <input
        id={inputId}
        type={isVisible ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        disabled={disabled}
        className={inputClassName}
      />
      <button
        type="button"
        onClick={() => setIsVisible((previous) => !previous)}
        aria-label={isVisible ? t('profile.hidePassword') : t('profile.showPassword')}
        className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-md p-1 text-app-text-secondary transition hover:text-app-text focus-ring-brand"
      >
        {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
};
