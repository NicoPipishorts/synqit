import type { Story } from '@ladle/react';

import {
  CONNECT_SERVICES,
  LINK_SERVICES,
  ServiceChip,
  ServiceLogo,
} from '../components/ServiceLogo';

export const Logos: Story = () => (
  <div className="grid gap-6">
    <div className="grid gap-2">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-app-text-secondary">
        Connect your account
      </p>
      <div className="flex items-center gap-3">
        {CONNECT_SERVICES.map((service) => (
          <ServiceLogo key={service.id} service={service.id} className="h-10 w-10" />
        ))}
      </div>
    </div>
    <div className="grid gap-2">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-app-text-secondary">
        Import from a link
      </p>
      <div className="flex items-center gap-3">
        {LINK_SERVICES.map((service) => (
          <ServiceLogo key={service.id} service={service.id} className="h-10 w-10" />
        ))}
      </div>
    </div>
  </div>
);

export const Chips: Story = () => (
  <div className="flex flex-wrap gap-3">
    <ServiceChip service="spotify" note="Connected" />
    <ServiceChip service="apple" note="Not connected" />
    <ServiceChip service="deezer" note="Matches track for track" />
    <ServiceChip service="youtube" note="Needs a server key" muted />
  </div>
);
