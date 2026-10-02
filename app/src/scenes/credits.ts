// CREDITS — after the last sample the white cuts to black and one credit card comes up, music-video style:
// the title at the top, three columns (music, music video, built with) in the video's own type —
// roles in mono, names in LINE Seed / Archivo — and a closing line. It holds, then goes to black.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, W, H, clearRT } from '../engine/gl';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { clamp, ease } from '../engine/util';

const ME = '노는사람 (nonunsaram)';
const AI = 'Claude Opus 5.5';
/** A column: its heading, then entries — [role, name] pairs, or a name with a list of roles under it. */
type Entry = { role: string; name: string } | { name: string; roles: string[] };
const COLS: { head: string; entries: Entry[] }[] = [
  { head: 'MUSIC', entries: [
    { role: 'LYRICS', name: ME },
    { role: 'TOPLINE MELODY', name: ME },
    { role: 'VOCALS · ARRANGEMENT', name: 'Suno' },
  ] },
  { head: 'MUSIC VIDEO', entries: [
    { role: 'CREATIVE DIRECTION · REVIEW', name: ME },
    { name: AI, roles: ['CONCEPT · TREATMENT', 'LYRIC & BEAT SYNC', 'TYPOGRAPHY', '3D DESIGN · MODELING', 'SHADERS', 'MOTION · CAMERA', 'RENDERING PIPELINE', 'EDIT'] },
  ] },
  { head: 'BUILT WITH', entries: [
    { role: 'VIDEO ENGINE', name: 'mexicat / pdoom-video' },
    { role: 'RENDERING', name: 'three.js' },
    { role: 'VOCAL ALIGNMENT', name: 'Demucs · MMS-FA · Whisper' },
    { role: 'TYPEFACES', name: 'LINE Seed KR · Noto Serif KR · Archivo' },
  ] },
];

export default class Credits extends Scene {
  L = new Layer2D();

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t - this.ctx.start, dur = this.ctx.end - this.ctx.start;
    clearRT(this.ctx.renderer, out, LIN.ink);
    const c = this.L.ctx; this.L.clear();
    c.textBaseline = 'alphabetic'; c.textAlign = 'center';
    // a beat of black; the card comes up (title first, then the three columns together), holds, and
    // fades back to black at the end
    const up = (d: number) => ease.outCubic(clamp((t - 0.5 - d) / 0.8));
    const down = 1 - ease.inOutCubic(clamp((t - (dur - 0.9)) / 0.8));
    const aT = up(0) * down, aC = up(0.35) * down, aN = up(0.7) * down;
    c.font = font(F.archivo(125, 900), 92); c.fillStyle = rgba('paper', aT);
    c.fillText('Feel The AGI', W / 2, 250 + (1 - up(0)) * 10);
    c.font = font(F.mono(500), 14); c.letterSpacing = '6px'; c.fillStyle = rgba('dawn', aT);
    c.fillText('CREDITS', W / 2 + 3, 302); c.letterSpacing = '0px';
    const role = (t: string, x: number, y: number, a: number) => { c.font = font(F.mono(500), 12); c.letterSpacing = '3px'; c.fillStyle = rgba('ash', a); c.fillText(t, x + 1.5, y); c.letterSpacing = '0px'; };
    const name = (t: string, x: number, y: number, a: number) => { c.font = font(/[가-힣]/.test(t) ? F.seed(700) : F.archivo(100, 600), 24); c.fillStyle = rgba('paper', a); c.fillText(t, x, y); };
    const head = (t: string, x: number, y: number) => { c.font = font(F.mono(500), 13); c.letterSpacing = '5px'; c.fillStyle = rgba('dawn', aC); c.fillText(t, x + 2.5, y); c.letterSpacing = '0px'; };
    const entry = (r: string, n: string, x: number, y: number) => { role(r, x, y, aC); name(n, x, y + 34, aC); };
    const HEADY = 410, ROW = 84, FIRST = HEADY + 62;
    // music (left) and built with (right): role over name, one under another
    const side = (col: typeof COLS[number], x: number) => {
      head(col.head, x, HEADY);
      col.entries.forEach((e, i) => { if ('role' in e) entry(e.role, e.name, x, FIRST + i * ROW); });
    };
    side(COLS[0]!, W * 0.16);
    side(COLS[2]!, W * 0.84);
    // music video (centre): the direction credit across the top, then Claude's eight roles in a 2 × 4
    // grid, each role over the name like every other credit
    const mv = COLS[1]!;
    head(mv.head, W / 2, HEADY);
    const dir = mv.entries[0]!, ai = mv.entries[1]!;
    if ('role' in dir) entry(dir.role, dir.name, W / 2, FIRST);
    if ('roles' in ai) ai.roles.forEach((r, i) => entry(r, ai.name, W / 2 + (i % 2 ? 1 : -1) * 175, FIRST + ROW * 1.25 + Math.floor(i / 2) * ROW));
    c.font = font(F.serif(400, true), 26); c.fillStyle = rgba('ash', aN);
    c.fillText('Every frame of this video is code, rendered from the song.', W / 2, 1000);
    c.textAlign = 'left';
    this.ctx.comp.draw(this.ctx.renderer, this.L.upload(), out);
    return { bloom: 0.3, bloomThreshold: 1.0, vignette: 0.3, grain: 0.04, ca: 0.3 };
  }
}
