import { motion } from 'framer-motion';

type SegmentedToggleOption<T extends string> = {
  value: T;
  label: string;
  activeVariant?: 'lime' | 'pink';
};

type SegmentedToggleProps<T extends string> = {
  value: T;
  options: SegmentedToggleOption<T>[];
  onChange: (value: T) => void;
  layoutId: string;
};

export const SegmentedToggle = <T extends string>({
  value,
  options,
  onChange,
  layoutId,
}: SegmentedToggleProps<T>) => (
  <div className="inline-flex rounded-full border border-app-border bg-app-elevated p-1 shadow-soft-lift dark:bg-app-card">
    {options.map((option) => {
      const isActive = option.value === value;
      const tone = option.activeVariant ?? 'lime';
      return (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`relative rounded-full px-5 py-2 text-center text-sm font-black tracking-tight transition-colors duration-200 focus-visible:outline-none ${
            isActive
              ? tone === 'lime'
                ? 'text-brand-dark'
                : 'text-brand-white'
              : 'text-app-text-muted hover:text-app-text'
          }`}
        >
          {isActive ? (
            <motion.span
              layoutId={layoutId}
              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              className={`absolute inset-0 rounded-full ${
                tone === 'lime' ? 'bg-brand-lime' : 'bg-brand-pink'
              }`}
            />
          ) : null}
          <span className="relative z-10">{option.label}</span>
        </button>
      );
    })}
  </div>
);
