// The one readout that runs through the whole video: time to dawn. It counts down to the moment the
// door opens (the second "I" of the build-up, when the 808 lands) and up afterwards.
import { W, H } from '../engine/gl';
import { rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import type { Lyrics } from '../engine/lyrics';
import { M } from './_kit';

let T0: number | null = null;
/** The time the door opens: the "I" of the third "Feel The AGI". */
export function dawnTime(ly: Lyrics) {
  if (T0 === null) {
    const l = ly.section('build').filter((x) => /Feel/.test(x.text))[2];
    const w = l?.words[l.words.length - 1];
    T0 = w?.syl?.[2]?.[0] ?? w?.start ?? 98.58;
  }
  return T0;
}

export function formatClock(dt: number) {
  const s = Math.abs(dt), m = Math.floor(s / 60), r = s - m * 60;
  return `${dt < 0 ? '−' : '+'}${String(m).padStart(2, '0')}:${r.toFixed(2).padStart(5, '0')}`;
}

/** Bottom-right of the title-safe area. tone: 'night' = paper on ink, 'day' = ink on paper. */
export function drawClock(c: CanvasRenderingContext2D, ly: Lyrics, t: number, tone: 'night' | 'day' = 'night', a = 1, top = false) {
  if (a <= 0.001) return;
  const T = dawnTime(ly);
  const dt = t - T;
  const after = dt >= 0;
  const fg = tone === 'night' ? 'paper' : 'ink';
  const gold = tone === 'night' ? rgba('dawn', 1) : 'rgba(184,116,12,1)';
  const w = 300, x1 = W - M, x0 = x1 - w, y = top ? M + 84 : H - M;
  c.save();
  c.textBaseline = 'alphabetic';
  // label
  c.textAlign = 'right';
  c.font = font(F.mono(500), 13);
  c.letterSpacing = '4px';
  c.fillStyle = after ? gold : rgba(tone === 'night' ? 'ash' : 'graphite', 0.85 * a);
  c.globalAlpha = a;
  c.fillText(after ? 'SINCE DAWN' : 'DAWN IN', x1 + 4, y - 58);
  c.letterSpacing = '0px';
  // the time, large
  c.font = font(F.mono(300), 40);
  c.fillStyle = after ? gold : rgba(fg, 0.92);
  c.fillText(formatClock(dt), x1, y - 14);
  // a hairline that fills from the start of the song to dawn (after dawn: full, gold)
  const p = Math.max(0, Math.min(1, t / T));
  c.fillStyle = rgba(fg, 0.18); c.fillRect(x0, y, w, 1);
  c.fillStyle = after ? gold : rgba(fg, 0.8); c.fillRect(x0, y - 1, w * p, 3);
  c.restore();
}

/**
 * How far dawn has come at song time t (0 = deepest night .. ~0.62 just before the door opens): the
 * sky climbs through the whole first half, from indigo through rose toward gold, so the door's light
 * is the end of a long sunrise rather than a surprise.
 */
export function dawnLevel(ly: Lyrics, t: number) {
  const T = dawnTime(ly);
  const keys: [number, number][] = [[0, 0.03], [13, 0.1], [26, 0.17], [52, 0.26], [77, 0.4], [83, 0.52], [89, 0.66], [T - 8, 0.7]];
  if (t <= 0) return keys[0]![1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i]!, [t0, v0] = keys[i - 1]!;
    if (t <= t1) { const u = (t - t0) / (t1 - t0); return v0 + (v1 - v0) * (u * u * (3 - 2 * u)); }
  }
  return keys[keys.length - 1]![1];
}

/** 0..1 decaying pulse on every beat of the analysed grid (steady, on the beat — not on the kicks). */
export function beatPulse(beat: number, hl = 0.09, bpm = 150) {
  const ph = beat - Math.floor(beat);
  return Math.pow(0.5, (ph * 60) / bpm / hl);
}
