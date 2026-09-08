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
  it('points every service at its own brand asset', () => {
    const sources = (['spotify', 'apple', 'deezer', 'youtube'] as const).map((service) => {
      const { unmount } = render(<ServiceLogo service={service} />);
      const src = screen
        .getByRole('img', { name: MUSIC_SERVICES[service].name })
        .getAttribute('src');
      unmount();
      return src;
    });

    expect(sources).toEqual([
      '/assets/logos/Providers/Spotify.png',
      '/assets/logos/Providers/AppleMusic.png',
      '/assets/logos/Providers/Deezer.png',
      '/assets/logos/Providers/YouTubeMusic.png',
    ]);
    expect(new Set(sources).size).toBe(4);
  });

  it('drops out of the accessibility tree when a neighbouring label names it', () => {
    render(<ServiceLogo service="youtube" alt="" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
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
