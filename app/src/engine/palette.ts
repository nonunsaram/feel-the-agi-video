import { hexToLinear } from './util';

// Night, paper, and the colours of a dawn sky. Type is paper on night (or night on paper once the
// light has come); the only warm thing is the light itself — see docs/TREATMENT.md.
export const HEX = {
  ink: '#050608', // night: the background black (slightly cold)
  ink2: '#0E1015', // raised black (panels, fields)
  graphite: '#4A4D57', // dim lines, secondary text
  ash: '#8E919B', // mid grey
  paper: '#F1EEE6', // paper white: primary type, and the ground of the daylight scenes
  dawn: '#FFB648', // the light: the caret, the door, the sung syllable
  glow: '#FFE3AE', // hot core of the light
  rose: '#FF3D6E', // the first colour of dawn; also refusal, anger, the strike-through
  indigo: '#23257A', // the sky just before dawn (large soft fields only, never lines)
} as const;

export type PaletteKey = keyof typeof HEX;

/** Linear RGB triplets for GL uniforms. */
export const LIN: Record<PaletteKey, [number, number, number]> = Object.fromEntries(
  Object.entries(HEX).map(([k, v]) => [k, hexToLinear(v)]),
) as Record<PaletteKey, [number, number, number]>;

/** CSS rgba() for Canvas2D. */
export function rgba(key: PaletteKey | string, a = 1): string {
  const hex = (HEX as Record<string, string>)[key] ?? key;
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
