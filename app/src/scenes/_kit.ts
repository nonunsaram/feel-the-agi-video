// Shared kit for every scene: syllable-level karaoke layout, the caret/light layer, the glitch
// compositor and the sky. Read docs/TREATMENT.md first.
import * as THREE from 'three';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { LIN, rgba, type PaletteKey } from '../engine/palette';
import { F, font, measure } from '../engine/type';
import type { Line, Word } from '../engine/lyrics';
import type { SceneCtx } from '../engine/scene';
import { clamp, ease, frameIdx, hash } from '../engine/util';

// ------------------------------------------------------------------ syllables
/** One sung unit: a Hangul syllable, a spelled letter (A, G, I) or a whole short word. */
export interface Syl {
  ch: string;
  t0: number;
  t1: number;
  word: Word;
  /** index within the word, and whether it starts a word */
  k: number;
  first: boolean;
}

export function wordSyls(w: Word): Syl[] {
  if (w.syl && w.syl.length > 1) {
    const parts = w.parts ?? Array.from(w.w);
    return w.syl.map(([a, b], k) => ({ ch: parts[k] ?? '', t0: a, t1: b, word: w, k, first: k === 0 }));
  }
  return [{ ch: w.w, t0: w.start, t1: w.end, word: w, k: 0, first: true }];
}
export const lineSyls = (l: Line): Syl[] => l.words.flatMap(wordSyls);

/** `fam`: the face this syllable is set in (lines may mix weights word by word). */
export interface PlacedSyl extends Syl { x: number; w: number; fam: string }
export interface LineLayout { syls: PlacedSyl[]; width: number; family: string; size: number }

/**
 * Lay a run of words out on one baseline, syllable by syllable, with the font's kerning inside a
 * word (each unit sits at the width of the word up to and including it, minus its own advance).
 * `gap` is the word space in em.
 */
export function layoutWords(words: Word[], family: string | ((w: Word) => string), size: number, gap = 0.28, tracking = 0): LineLayout {
  const out: PlacedSyl[] = [];
  const famOf = typeof family === 'string' ? () => family : family;
  let x = 0;
  for (const w of words) {
    const fam = famOf(w);
    const ss = wordSyls(w);
    let prefix = '';
    ss.forEach((s, k) => {
      prefix += s.ch;
      const wd = measure(s.ch, fam, size);
      out.push({ ...s, x: x + measure(prefix, fam, size) - wd + k * tracking, w: wd, fam });
    });
    x += measure(prefix, fam, size) + (ss.length - 1) * tracking + gap * size;
  }
  return { syls: out, width: Math.max(0, x - gap * size), family: out[0]?.fam ?? famOf(words[0]!), size };
}

/** LINE Seed: words in `bold` are set Bold, the rest Regular (revision 3's mixed-weight lines). */
export const seedMix = (bold: string[]) => (w: Word) => (bold.includes(w.w.replace(/[^\uac00-\ud7a3A-Za-z]/g, '')) ? F.seed(700) : F.seed(400));

/** 0 before the unit is sung, then 1 (with a short ramp of `rise` s). */
export const sung = (s: { t0: number }, t: number, rise = 0.04) => clamp((t - s.t0) / rise);
/** 1 → 0 pulse after the unit's start (half-life hl). */
export const hitOf = (s: { t0: number }, t: number, hl = 0.09) => (t < s.t0 ? 0 : Math.pow(0.5, (t - s.t0) / hl));
/** The unit being sung at t (last one started), or null before the first. */
export function currentSyl<T extends { t0: number }>(syls: T[], t: number): T | null {
  let cur: T | null = null;
  for (const s of syls) if (s.t0 <= t) cur = s; else break;
  return cur;
}

/**
 * Draw a laid-out line: sung units solid in `fg`, the unit being sung in `hi`, unsung ones at
 * `ghost` alpha (0 = not there yet). Each unit pops a little as it lands (`pop` px of rise).
 */
export function drawLine(c: CanvasRenderingContext2D, lay: LineLayout, x: number, y: number, t: number,
  o: { fg?: string; hi?: string; ghost?: number; pop?: number; hold?: number } = {}) {
  const fg = o.fg ?? 'paper', hi = o.hi ?? fg, ghost = o.ghost ?? 0, pop = o.pop ?? 0, hold = o.hold ?? 0.12;
  c.textBaseline = 'alphabetic';
  for (const s of lay.syls) {
    c.font = font(s.fam, lay.size);
    const k = sung(s, t);
    if (k <= 0) {
      if (ghost > 0) { c.fillStyle = rgba(fg, ghost); c.fillText(s.ch, x + s.x, y); }
      continue;
    }
    const active = t < Math.max(s.t1, s.t0 + hold);
    const dy = pop ? -pop * (1 - ease.outExpo(clamp((t - s.t0) / 0.18))) : 0;
    c.fillStyle = rgba(active ? hi : fg, 1);
    c.fillText(s.ch, x + s.x, y + dy);
  }
}

// ------------------------------------------------------------------ light layer
/**
 * A Canvas2D layer composited additively with an HDR tint, so whatever is drawn on it in white
 * glows (bloom starts at ~0.85 linear). The caret, the door's slit and sparks live here.
 */
export class Light {
  layer: Layer2D;
  constructor(scale?: number) { this.layer = new Layer2D(W, H, scale); }
  get ctx() { return this.layer.ctx; }
  clear() { this.layer.clear(); }
  draw(ctx: SceneCtx, out: THREE.WebGLRenderTarget, gain = 2.6, key: PaletteKey = 'dawn') {
    const c = LIN[key];
    ctx.comp.draw(ctx.renderer, this.layer.upload(), out, { mode: 'add', tint: [c[0] * gain, c[1] * gain, c[2] * gain] });
  }
}

/**
 * The caret: a vertical bar of light. (x, y) is its foot on the baseline; h its height.
 * `blink` 0..1 visibility (use caretBlink for the beat-synced square wave).
 */
export function drawCaret(c: CanvasRenderingContext2D, x: number, y: number, h: number, w = 5, a = 1) {
  if (a <= 0.001) return;
  c.fillStyle = `rgba(255,255,255,${a})`;
  c.fillRect(Math.round(x), Math.round(y - h), w, h);
}
/** Beat-synced blink: on for the first half of every beat. While `typing` it stays on. */
export const caretBlink = (beat: number, typing = false) => (typing ? 1 : beat - Math.floor(beat) < 0.5 ? 1 : 0);

/** A four-point glint (two hairlines crossing), for "반짝". r = arm length. */
export function drawGlint(c: CanvasRenderingContext2D, x: number, y: number, r: number, a = 1, rot = 0) {
  if (a <= 0.001 || r <= 0.2) return;
  c.save();
  c.translate(x, y); c.rotate(rot);
  c.fillStyle = `rgba(255,255,255,${a})`;
  for (let k = 0; k < 2; k++) {
    c.beginPath();
    c.moveTo(-r, 0); c.quadraticCurveTo(0, -r * 0.035, r, 0); c.quadraticCurveTo(0, r * 0.035, -r, 0);
    c.fill();
    c.rotate(Math.PI / 2);
  }
  c.restore();
}

// ------------------------------------------------------------------ glitch compositor
const GLITCH = /* glsl */ `
uniform sampler2D tex; uniform float seed, split, slice, block, scan, keystone, tear, opacity, gain;
uniform vec3 tint; uniform vec2 shift;
vec4 tap(vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
  vec4 c = texture(tex, uv);
  return vec4(c.rgb * c.a, c.a);
}
void main() {
  vec2 uv = vUv + shift;
  // keystone: looking up at a monolith (narrower toward the top for k > 0)
  uv.x = (uv.x - 0.5) * (1.0 + keystone * (uv.y - 0.5) * 2.0) + 0.5;
  float y = uv.y * 1080.0;
  // slices: horizontal bands displaced sideways, re-dealt every frame (seed)
  if (slice > 0.0) {
    float band = floor(y / mix(90.0, 14.0, hash11(seed * 3.1 + 7.0)));
    float r = hash12(vec2(band, seed));
    if (r < slice * 0.55) uv.x += (hash12(vec2(band + 3.0, seed)) - 0.5) * 0.22 * slice;
  }
  // tear: one band jumps vertically
  if (tear > 0.0) {
    float ty = hash11(seed * 1.7), th = 0.04 + 0.1 * hash11(seed * 2.3);
    if (abs(uv.y - ty) < th) uv.y += (hash11(seed * 5.1) - 0.5) * 0.12 * tear;
  }
  // blocks: mosaic cells hold a displaced sample
  if (block > 0.0) {
    vec2 cell = floor(uv * vec2(32.0, 18.0));
    float r = hash12(cell + seed * 13.0);
    if (r < block * 0.35) uv = (cell + 0.5 + (hash22(cell + seed) - 0.5) * 3.0 * block) / vec2(32.0, 18.0);
  }
  vec2 d = vec2(split / 1920.0, 0.0);
  vec4 cr = tap(uv + d), cg = tap(uv), cb = tap(uv - d);
  vec4 col = vec4(cr.r, cg.g, cb.b, max(cg.a, max(cr.a, cb.a)));
  // scanlines: every third logical row dimmed
  if (scan > 0.0) col.rgb *= 1.0 - scan * step(2.0, mod(floor(FRAG_PX.y), 3.0));
  fragColor = vec4(col.rgb * tint * gain, col.a) * opacity;
}`;

export interface GlitchParams {
  /** RGB channel split in px */ split?: number;
  /** 0..1 sideways band displacement */ slice?: number;
  /** 0..1 mosaic displacement */ block?: number;
  /** 0..1 vertical tear */ tear?: number;
  /** 0..1 scanline depth */ scan?: number;
  /** keystone amount (0 = none; 0.3 = looking up) */ keystone?: number;
  tint?: [number, number, number]; gain?: number; opacity?: number; shift?: [number, number];
  /** frame seed; defaults to the 60 fps frame index of t */ seed?: number;
  mode?: 'normal' | 'add';
}

/** Composites a Layer2D over the target through the glitch shader (premultiplied alpha-over, or additive). */
export class Glitch {
  private passes: Record<string, FSPass> = {};
  private get(mode: 'normal' | 'add') {
    let p = this.passes[mode];
    if (!p) {
      p = new FSPass(GLITCH, {
        tex: { value: null }, seed: { value: 0 }, split: { value: 0 }, slice: { value: 0 }, block: { value: 0 }, scan: { value: 0 },
        keystone: { value: 0 }, tear: { value: 0 }, opacity: { value: 1 }, gain: { value: 1 },
        tint: { value: new THREE.Vector3(1, 1, 1) }, shift: { value: new THREE.Vector2() },
      }, { blending: THREE.CustomBlending, transparent: true });
      const m = p.mat;
      m.blendEquation = THREE.AddEquation;
      m.blendSrc = THREE.OneFactor;
      m.blendDst = mode === 'add' ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor;
      m.blendSrcAlpha = mode === 'add' ? THREE.ZeroFactor : THREE.OneFactor;
      m.blendDstAlpha = mode === 'add' ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor;
      this.passes[mode] = p;
    }
    return p;
  }
  draw(ctx: SceneCtx, tex: THREE.Texture, out: THREE.WebGLRenderTarget, t: number, g: GlitchParams = {}) {
    const p = this.get(g.mode ?? 'normal'), u = p.u;
    u.tex!.value = tex;
    u.seed!.value = g.seed ?? (frameIdx(t) % 9973) + 1;
    u.split!.value = g.split ?? 0; u.slice!.value = g.slice ?? 0; u.block!.value = g.block ?? 0; u.tear!.value = g.tear ?? 0;
    u.scan!.value = g.scan ?? 0; u.keystone!.value = g.keystone ?? 0; u.opacity!.value = g.opacity ?? 1; u.gain!.value = g.gain ?? 1;
    (u.tint!.value as THREE.Vector3).set(...(g.tint ?? [1, 1, 1]));
    (u.shift!.value as THREE.Vector2).set(g.shift?.[0] ?? 0, g.shift?.[1] ?? 0);
    p.render(ctx.renderer, out);
  }
}

/** A burst envelope for glitches: 1 for `frames` frames after t0, stepping down (deterministic per frame). */
export function burst(t: number, t0: number, frames = 5) {
  const n = frameIdx(t) - frameIdx(t0);
  return n < 0 || n >= frames ? 0 : 1 - n / frames;
}
/** Per-frame random in [0,1) (constant over a frame's shutter). */
export const frnd = (t: number, salt = 0) => hash(frameIdx(t), salt);

// ------------------------------------------------------------------ sky
const SKY = /* glsl */ `
uniform float level, horizon, glowAmt, day, t;
void main() {
  // y: 0 at the horizon line, positive above
  vec2 p = vec2((vUv.x - 0.5) * 16.0 / 9.0, vUv.y - horizon);
  float up = max(p.y, 0.0);
  // the band of dawn sits on the horizon and thins upward; level raises it through the ramp
  float band = exp(-up * mix(9.0, 2.2, level)) * (0.55 + 0.45 * exp(-p.x * p.x * mix(3.0, 0.6, level)));
  vec3 sky = dawn(level * band) * mix(0.0, 1.0, smoothstep(0.0, 0.08, level * band + 0.02));
  sky += C_INDIGO * 0.035 * exp(-up * 2.5) * (1.0 - level) * glowAmt;
  // ground: darker, picks up a little of the sky near the line
  vec3 ground = dawn(level * 0.55 * exp(p.y * 14.0)) * 0.35;
  vec3 col = p.y >= 0.0 ? sky : ground;
  // the horizon itself: a hairline of light whose brightness follows level
  float line = pxLine(abs(p.y) * 1080.0, 0.2, 1.4);
  col += C_DAWN * line * (0.04 + 1.6 * level) * exp(-p.x * p.x * mix(10.0, 1.2, level));
  col = mix(max(col, C_INK * 0.6), C_PAPER, day);
  fragColor = vec4(col, 1.0);
}`;

/**
 * Background: night with a horizon. `level` 0..1 is how far dawn has come (0 = black night with a
 * faint cold band, 1 = gold-white), `horizon` its height (0..1 from the bottom), `day` 0..1 mixes to
 * flat paper (the daylight scenes).
 */
export class Sky {
  pass = new FSPass(SKY, { level: { value: 0 }, horizon: { value: 0.3 }, glowAmt: { value: 1 }, day: { value: 0 }, t: { value: 0 } });
  render(ctx: SceneCtx, out: THREE.WebGLRenderTarget, o: { level?: number; horizon?: number; glow?: number; day?: number; t?: number } = {}) {
    const u = this.pass.u;
    u.level!.value = o.level ?? 0; u.horizon!.value = o.horizon ?? 0.3; u.glowAmt!.value = o.glow ?? 1; u.day!.value = o.day ?? 0; u.t!.value = o.t ?? 0;
    this.pass.render(ctx.renderer, out);
  }
}

/** Hairline helpers in Canvas2D (crisp 1 px lines at integer + 0.5). */
export function hline(c: CanvasRenderingContext2D, x0: number, x1: number, y: number, col: string, w = 1) {
  c.fillStyle = col; c.fillRect(x0, Math.round(y) - (w > 1 ? w / 2 : 0), x1 - x0, w);
}
export function vline(c: CanvasRenderingContext2D, x: number, y0: number, y1: number, col: string, w = 1) {
  c.fillStyle = col; c.fillRect(Math.round(x) - (w > 1 ? w / 2 : 0), y0, w, y1 - y0);
}

/** Layout grid: 12 columns inside the title-safe area (96 px margins). */
export const M = 96;
export const col12 = (k: number) => M + ((W - 2 * M) * k) / 12;
