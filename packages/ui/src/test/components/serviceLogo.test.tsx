import { render, screen } from '@testing-library/react';

import {
  CONNECT_SERVICES,
  LINK_SERVICES,
  MUSIC_SERVICES,
  ServiceChip,
  ServiceLogo,
} from '../../components/ServiceLogo';

describe('service catalog', () => {
  it('splits services by how they reach Synqit', () => {
    expect(CONNECT_SERVICES.map((service) => service.id)).toEqual(['spotify', 'apple']);
    expect(LINK_SERVICES.map((service) => service.id)).toEqual(['deezer', 'youtube']);
    expect(CONNECT_SERVICES.every((service) => service.access === 'connect')).toBe(true);
    expect(LINK_SERVICES.every((service) => service.access === 'link')).toBe(true);
  });

  it('names every service', () => {
    expect(Object.values(MUSIC_SERVICES).map((service) => service.name)).toEqual([
      'Spotify',
      'Apple Music',
      'Deezer',
      'YouTube Music',
    ]);
  });
});

describe('ServiceLogo', () => {
  it('renders the official image mark for connected services', () => {
    render(<ServiceLogo service="spotify" />);
    const image = screen.getByRole('img', { name: 'Spotify' });
    expect(image).toHaveAttribute('src', '/assets/logos/Providers/Spotify.png');
  });

  it('renders a drawn mark with an accessible name for link services', () => {
    render(<ServiceLogo service="deezer" />);
    expect(screen.getByRole('img', { name: 'Deezer' })).toBeInTheDocument();
  });

  it('hides the mark from assistive tech when a neighbouring label names it', () => {
    const { container } = render(<ServiceLogo service="youtube" alt="" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });
});

describe('ServiceChip', () => {
  it('labels the service once and shows the optional note', () => {
    render(<ServiceChip service="deezer" note="matches track for track" />);
    expect(screen.getByText('Deezer')).toBeInTheDocument();
    expect(screen.getByText('matches track for track')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
