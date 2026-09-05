import type { Story } from '@ladle/react';
import { Plus, Trash2, X } from 'lucide-react';

import { CTAAnchor, CTAButton, CTAMobileIconLabel, type CtaVariant } from '../components/cta';
import { IconButton } from '../components/IconButton';

const VARIANTS: CtaVariant[] = ['primary', 'secondary', 'danger', 'dangerSoft', 'ghost'];

export const Buttons: Story = () => (
  <div className="grid gap-4">
    {(['md', 'lg'] as const).map((size) => (
      <div key={size} className="flex flex-wrap items-center gap-3">
        {VARIANTS.map((variant) => (
          <CTAButton key={variant} variant={variant} size={size}>
            {variant}
          </CTAButton>
        ))}
        <CTAButton variant="primary" size={size} disabled>
          disabled
        </CTAButton>
      </div>
    ))}
  </div>
);

export const Anchors: Story = () => (
  <div className="flex flex-wrap gap-3">
    <CTAAnchor href="#" variant="primary">
      Primary link
    </CTAAnchor>
    <CTAAnchor href="#" variant="secondary" disabled>
      Disabled link
    </CTAAnchor>
    <CTAAnchor href="#" variant="danger">
      <CTAMobileIconLabel icon={<Trash2 size={14} aria-hidden="true" />} label="Delete" />
    </CTAAnchor>
  </div>
);

export const IconButtons: Story = () => (
  <div className="flex items-center gap-3">
    <IconButton aria-label="Add" size="sm" icon={<Plus size={14} />} />
    <IconButton aria-label="Add" size="md" icon={<Plus size={18} />} />
    <IconButton aria-label="Close" size="lg" icon={<X size={22} />} withShadow={false} />
  </div>
);
