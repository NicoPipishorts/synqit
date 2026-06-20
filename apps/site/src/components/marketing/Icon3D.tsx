import { useId } from 'react';

export type Icon3DTone = 'lime' | 'pink';

export type Icon3DProps = {
  tone?: Icon3DTone;
  className?: string;
};

// Faux-3D icons: a front face (vertical gradient), an extruded "thickness" layer
// behind/below it (darker), a soft contact shadow, and a glossy highlight. Crisp
// at any size, theme-able, and a few hundred bytes each. Two brand palettes.
type Palette = {
  hi: string;
  light: string;
  base: string;
  mid: string;
  side1: string;
  side2: string;
  shadow: string;
};

const PALETTES: Record<Icon3DTone, Palette> = {
  lime: {
    hi: '#f2ffb4',
    light: '#e2ff7c',
    base: '#c6ff00',
    mid: '#a6df00',
    side1: '#9bd000',
    side2: '#6f9800',
    shadow: '#2f4500',
  },
  pink: {
    hi: '#ffd6e8',
    light: '#ff86ba',
    base: '#ff2e8b',
    mid: '#e21f76',
    side1: '#cf1c6b',
    side2: '#8f1149',
    shadow: '#3f0a24',
  },
};

const ClayDefs = ({ id, tone }: { id: string; tone: Icon3DTone }) => {
  const p = PALETTES[tone];
  return (
    <defs>
      <linearGradient id={`${id}-face`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={p.light} />
        <stop offset="0.55" stopColor={p.base} />
        <stop offset="1" stopColor={p.mid} />
      </linearGradient>
      <linearGradient id={`${id}-side`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={p.side1} />
        <stop offset="1" stopColor={p.side2} />
      </linearGradient>
      <radialGradient id={`${id}-puff`} cx="0.36" cy="0.3" r="0.9">
        <stop offset="0" stopColor={p.hi} />
        <stop offset="0.58" stopColor={p.base} />
        <stop offset="1" stopColor={p.mid} />
      </radialGradient>
      <radialGradient id={`${id}-gloss`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
};

const useClay = (tone: Icon3DTone) => {
  const id = useId().replace(/:/g, '');
  return { id, p: PALETTES[tone] };
};

const svgProps = (className?: string) => ({
  viewBox: '0 0 64 64',
  className,
  fill: 'none' as const,
  xmlns: 'http://www.w3.org/2000/svg',
  'aria-hidden': true,
  focusable: false,
});

export const PhoneIcon3D = ({ tone = 'lime', className }: Icon3DProps) => {
  const { id, p } = useClay(tone);
  return (
    <svg {...svgProps(className)}>
      <ClayDefs id={id} tone={tone} />
      <ellipse cx="32" cy="58" rx="15" ry="3" fill={p.shadow} opacity="0.18" />
      <rect x="22" y="10" width="22" height="46" rx="6" fill={`url(#${id}-side)`} />
      <rect x="21" y="8" width="22" height="46" rx="6" fill={`url(#${id}-face)`} />
      <rect x="24" y="13" width="16" height="34" rx="3" fill={p.side2} opacity="0.5" />
      <rect x="29" y="10.6" width="6" height="1.6" rx="0.8" fill={p.side2} opacity="0.5" />
      <ellipse cx="27" cy="18" rx="4" ry="9" fill={`url(#${id}-gloss)`} />
    </svg>
  );
};

export const SparkleIcon3D = ({ tone = 'lime', className }: Icon3DProps) => {
  const { id, p } = useClay(tone);
  return (
    <svg {...svgProps(className)}>
      <ClayDefs id={id} tone={tone} />
      <ellipse cx="32" cy="58" rx="11" ry="3" fill={p.shadow} opacity="0.18" />
      <path
        d="M32 11 L37 29 L55 34 L37 39 L32 57 L27 39 L9 34 L27 29 Z"
        fill={`url(#${id}-side)`}
      />
      <path d="M32 9 L37 27 L55 32 L37 37 L32 55 L27 37 L9 32 L27 27 Z" fill={`url(#${id}-puff)`} />
      <ellipse cx="28" cy="24" rx="4" ry="5" fill={`url(#${id}-gloss)`} />
    </svg>
  );
};

export const SwapIcon3D = ({ tone = 'lime', className }: Icon3DProps) => {
  const { id, p } = useClay(tone);
  return (
    <svg {...svgProps(className)}>
      <ClayDefs id={id} tone={tone} />
      <ellipse cx="32" cy="55" rx="18" ry="3" fill={p.shadow} opacity="0.18" />
      <path d="M14 24 L39 24 L39 20 L52 27.5 L39 35 L39 31 L14 31 Z" fill={`url(#${id}-side)`} />
      <path d="M14 22 L39 22 L39 18 L52 25.5 L39 33 L39 29 L14 29 Z" fill={`url(#${id}-face)`} />
      <path d="M50 37 L25 37 L25 33 L12 40.5 L25 48 L25 44 L50 44 Z" fill={`url(#${id}-side)`} />
      <path d="M50 35 L25 35 L25 31 L12 38.5 L25 46 L25 42 L50 42 Z" fill={`url(#${id}-face)`} />
      <ellipse cx="20" cy="25.5" rx="3" ry="1.6" fill={`url(#${id}-gloss)`} />
    </svg>
  );
};

export const ShieldIcon3D = ({ tone = 'lime', className }: Icon3DProps) => {
  const { id, p } = useClay(tone);
  return (
    <svg {...svgProps(className)}>
      <ClayDefs id={id} tone={tone} />
      <ellipse cx="32" cy="56" rx="15" ry="3" fill={p.shadow} opacity="0.18" />
      <path d="M32 11 L51 18 L51 31 Q51 45 32 54 Q13 45 13 31 L13 18 Z" fill={`url(#${id}-side)`} />
      <path d="M32 9 L50 16 L50 30 Q50 44 32 53 Q14 44 14 30 L14 16 Z" fill={`url(#${id}-puff)`} />
      <ellipse cx="24" cy="22" rx="5" ry="8" fill={`url(#${id}-gloss)`} />
    </svg>
  );
};

export const SparkIcon3D = ({ tone = 'lime', className }: Icon3DProps) => {
  const { id, p } = useClay(tone);
  return (
    <svg {...svgProps(className)}>
      <ClayDefs id={id} tone={tone} />
      <ellipse cx="30" cy="58" rx="11" ry="3" fill={p.shadow} opacity="0.18" />
      <path d="M37 10 L19 36 L30 36 L26 56 L46 30 L34 30 L41 10 Z" fill={`url(#${id}-side)`} />
      <path d="M37 8 L19 34 L30 34 L26 54 L46 28 L34 28 L41 8 Z" fill={`url(#${id}-face)`} />
      <ellipse cx="30" cy="18" rx="3" ry="7" fill={`url(#${id}-gloss)`} />
    </svg>
  );
};
