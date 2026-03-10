import { AdminPermissionLevel } from '@synqit/shared';

type AccessLevelUi = AdminPermissionLevel | 'none';

type PermissionLevelSliderProps = {
  value: AccessLevelUi;
  onChange: (next: AccessLevelUi) => void;
  disabled?: boolean;
  labels: {
    none: string;
    read: string;
    write: string;
  };
};

const OPTIONS: AccessLevelUi[] = ['none', 'read', 'write'];

export const PermissionLevelSlider = ({
  value,
  onChange,
  disabled = false,
  labels,
}: PermissionLevelSliderProps) => {
  return (
    <div
      className={`inline-grid grid-cols-3 rounded-lg border border-app-border bg-app-bg p-1 ${
        disabled ? 'opacity-60' : ''
      }`}
      role="group"
      aria-label="Permission level"
    >
      {OPTIONS.map((option) => {
        const active = value === option;
        const label =
          option === 'none' ? labels.none : option === 'read' ? labels.read : labels.write;
        return (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option)}
            className={`min-w-14 cursor-pointer rounded-md px-2 py-1 text-[11px] font-black uppercase tracking-wide transition ${
              active
                ? 'bg-brand-lime text-brand-dark'
                : 'text-app-text-secondary hover:bg-app-surface dark:hover:bg-app-card'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};
