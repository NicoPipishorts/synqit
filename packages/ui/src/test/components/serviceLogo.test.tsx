import { render, screen } from '@testing-library/react';

import {
  CONNECT_SERVICES,
  getServiceMarkSrc,
  isMonochromeServiceMark,
  LINK_SERVICES,
  MUSIC_SERVICES,
  ServiceChip,
  ServiceLogo,
} from '../../components/ServiceLogo';

describe('service catalog', () => {
  it('splits services by how they reach Synqit', () => {
    expect(CONNECT_SERVICES.map((service) => service.id)).toEqual(['spotify', 'apple', 'tidal']);
    expect(LINK_SERVICES.map((service) => service.id)).toEqual(['deezer', 'youtube']);
    expect(CONNECT_SERVICES.every((service) => service.access === 'connect')).toBe(true);
    expect(LINK_SERVICES.every((service) => service.access === 'link')).toBe(true);
  });

  it('names every service', () => {
    expect(Object.values(MUSIC_SERVICES).map((service) => service.name)).toEqual([
      'Spotify',
      'Apple Music',
      'TIDAL',
      'Deezer',
      'YouTube Music',
    ]);
  });

  it('gives every offered service its own brand mark', () => {
    const offered = [...CONNECT_SERVICES, ...LINK_SERVICES];
    const marks = offered.map((service) => getServiceMarkSrc(service.id));
    expect(marks.every((mark) => mark.length > 0)).toBe(true);
    expect(new Set(marks).size).toBe(offered.length);
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

  it('paints a monochrome mark with the surrounding text colour', () => {
    // TIDAL ships one shape in black and in white. Drawing either would hide it on half the
    // surfaces we use, so it is masked and takes `currentColor` instead.
    expect(isMonochromeServiceMark('tidal')).toBe(true);
    expect(isMonochromeServiceMark('spotify')).toBe(false);

    const { container } = render(<ServiceLogo service="tidal" />);
    const mark = screen.getByRole('img', { name: 'TIDAL' });
    expect(mark.tagName).toBe('SPAN');
    expect(mark.className).toContain('bg-current');
    expect(mark.getAttribute('style')).toContain(getServiceMarkSrc('tidal'));
    expect(container.querySelector('img')).toBeNull();
  });

  it('names a masked mark, and hides it when a label already does', () => {
    const { container } = render(<ServiceLogo service="tidal" alt="" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
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
