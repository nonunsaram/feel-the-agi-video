// DOOR — the build-up, the core of the video: "Feel the AGI" ×4, "yah" ×6.
// A void. Far away, a door; only the light leaking around it says it is there. The words arrive as
// the smallest type in the video. On each "I" of AGI the 808 lands and the door moves: the slit of
// light IS the letter I.
//   I¹ (a cappella bar, then the 808)   the door opens a hand's width; light falls across the floor
//   I²                                  a little more; the three yahs cut the camera closer
//   808 sustain                         the door drifts almost shut
//   I³ (second a cappella bar + 808)    it opens all the way: the frame is only light — the dawn
//                                       ramp as a field, A G I inside it as faint changes of tone
//   I⁴, yah ×3                          the field climbs to white paper: verse 2 begins in daylight
import type * as THREE from 'three';
import { BOLD } from '../engine/scale';

import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { rgba } from '../engine/palette';
import { F, font, measure } from '../engine/type';
import type { Line, Lyrics } from '../engine/lyrics';
import { clamp, ease, keys, lerp, noise1, prog, pulse, smoothstep, type Key } from '../engine/util';
import { wordSyls, type Syl, M } from './_kit';
import { drawClock } from './_clock';
import { Entity } from './_entity';
import { hudBegin } from '../engine/hud';
import { POSE, drawFigure, poseAt } from './_figure';

const FRAG = /* glsl */ `
uniform float open, leak, dist, bright, field, level, day, t, flare, through;
const float FOC = 1.15, CAMH = 1.0, DW = 1.0, DH = 3.1;
void main() {
  vec2 p = (vUv - 0.5) * vec2(16.0 / 9.0, 1.0);
  p.y += 0.13;                                   // horizon a little below the middle
  float Z = dist;
  float wpp = Z / FOC / 1080.0;                  // world units per logical pixel at the door
  vec2 dp = vec2(p.x * Z / FOC, p.y * Z / FOC + CAMH); // point on the door's plane (floor at y = 0)
  float s = open * DW;
  vec3 col = vec3(0.0);
  float inY = smoothstep(-wpp, wpp, dp.y) * (1.0 - smoothstep(DH - wpp, DH + wpp, dp.y));
  // the slit: the room behind is only light
  float slit = (1.0 - smoothstep(s * 0.5 - wpp, s * 0.5 + wpp, abs(dp.x))) * inY * step(1e-4, open);
  float doorway = slit; // what of the frame is seen through the open door
  col += mix(C_DAWN, C_GLOW, 0.75) * slit * bright * mix(7.0, 3.2, smoothstep(20.0, 6.0, dist));
  // light leaking around the closed panel: thin on the sides and top, stronger under it
  float ex = abs(abs(dp.x) - DW * 0.5);
  float inX = 1.0 - smoothstep(DW * 0.5, DW * 0.5 + wpp * 2.0, abs(dp.x));
  float side = exp(-ex / (wpp * 1.3)) * inY;
  float top = exp(-abs(dp.y - DH) / (wpp * 1.3)) * inX;
  float bot = exp(-abs(dp.y) / (wpp * 1.8)) * inX;
  col += C_DAWN * leak * (side * 0.45 + top * 0.3 + bot * 1.5);
  // the floor
  if (p.y < -1e-4) {
    float Zf = CAMH * FOC / (-p.y);
    float X = p.x * Zf / FOC;
    float d = Z - Zf;                            // distance in front of the door
    if (d > 0.0) {
      // the wedge from the slit: widens and softens with distance
      float hw = s * 0.5 + d * (0.10 + 0.55 * open);
      float soft = 0.03 + d * (0.05 + 0.25 * open);
      float wedge = (1.0 - smoothstep(hw - soft, hw + soft, abs(X))) / (1.0 + 0.18 * d + 0.02 * d * d);
      col += mix(C_DAWN, C_GLOW, 0.4) * wedge * bright * (0.25 + 2.2 * open) * step(1e-4, open);
      // under the closed door: a short fan
      float fan = (1.0 - smoothstep(0.0, DW * 0.5 + d * 0.9, abs(X))) * exp(-d * 1.1);
      col += C_DAWN * leak * fan * 0.5;
      // floor texture: faint streaks toward the door, so the floor reads as a plane
      float streak = 0.94 + 0.06 * snoise(vec2(X * 22.0, d * 0.35));
      col *= streak;
    }
    // mirror of the slit in the floor (slightly glossy)
    vec2 mp = vec2(p.x * Z / FOC, -(p.y * Z / FOC + CAMH));
    float mh = s * 0.5 + mp.y * 0.04;
    float mir = (1.0 - smoothstep(mh - wpp * 2.0, mh + wpp * 6.0, abs(mp.x))) * step(0.0, mp.y) * exp(-mp.y * 1.3);
    col += C_DAWN * mir * bright * 0.9 * step(1e-4, open);
  }
  // air: a faint glow hanging in front of the slit
  float air = exp(-length(vec2(dp.x * 1.6, dp.y - DH * 0.5)) / (0.9 + 2.5 * open)) * open;
  col += C_DAWN * air * bright * 0.22;
  col *= 1.0 + 0.45 * flare;
  // the field: nothing but light
  float n = snoise(vec3(vUv * vec2(1.6, 0.9), t * 0.12));
  float lv = level + 0.16 * (0.5 - vUv.y) + 0.035 * n - 0.10 * length(vUv - 0.5);
  vec3 fcol = dawn(lv);
  col = mix(col, fcol, field);
  doorway *= through;
  col = mix(col, C_PAPER, day);
  fragColor = vec4(col, 1.0);
}`;

export default class Door extends Scene {
  pass = new FSPass(FRAG, {
    open: { value: 0 }, leak: { value: 0 }, dist: { value: 26 }, bright: { value: 1 }, field: { value: 0 },
    level: { value: 0.5 }, day: { value: 0 }, t: { value: 0 }, flare: { value: 0 }, through: { value: 0 },
  });
  L = new Layer2D();
  ent = new Entity();
  ph: { line: Line; syls: Syl[]; tI: number }[] = [];
  yah: Syl[] = [];
  kOpen: Key[] = []; kDist: Key[] = []; kLeak: Key[] = [];
  tDawn = 0;
  tCut = 0;

  override init() {
    const { lyrics, start, end } = this.ctx;
    const lines = lyrics.section('build');
    const feel = lines.filter((l) => /Feel/.test(l.text));
    const yl = lines.filter((l) => /yah/.test(l.text));
    if (feel.length !== 4 || yl.length !== 2) throw new Error('door: expected 4 phrases and 2 yah lines');
    this.ph = feel.map((line) => {
      const syls = line.words.flatMap(wordSyls);
      return { line, syls, tI: syls[syls.length - 1]!.t0 };
    });
    this.yah = yl.flatMap((l) => l.words.flatMap(wordSyls));
    const [I1, I2, I3] = this.ph.map((p) => p.tI) as [number, number, number, number];
    const y = this.yah.map((s) => s.t0);
    this.tDawn = I3;
    // the hard cut into the light: one beat after the door bursts open
    this.tCut = this.ctx.audio.timeOfBeat(this.ctx.audio.beatAt(I3) + 1);
    const X = ease.outExpo, S = ease.inOutCubic;
    // how far the door is open (fraction of its width)
    this.kOpen = [
      [start, 0], [I1 - 0.001, 0], [I1 + 0.16, 0.085, X], [I2 - 0.001, 0.085], [I2 + 0.16, 0.16, X],
      [y[2]! + 0.25, 0.16], [I3 - 0.9, 0.014, S], [I3 - 0.001, 0.014], [I3 + 0.14, 1.0, X],
    ];
    // camera distance to the door: a slow push, cut closer on each yah
    this.kDist = [
      [start, 27], [I1, 25.5, ease.linear], [y[0]! - 0.001, 22, ease.linear],
      [y[0]!, 15], [y[1]! - 0.001, 14.4, ease.linear], [y[1]!, 9.5], [y[2]! - 0.001, 9.1, ease.linear], [y[2]!, 6.2],
      [I3 - 0.001, 5.2, ease.linear], [I3 + 0.3, 1.2, ease.outExpo],
    ];
    this.kLeak = [[start, 0], [start + 0.5, 1, ease.outCubic], [I1 - 0.001, 1], [I1 + 0.05, 0.25], [y[2]! + 0.3, 0.25], [I3 - 0.9, 1, S], [I3, 1]];
    void end;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { start, end, lyrics } = this.ctx;
    const [p1, p2, p3, p4] = this.ph as [Door['ph'][0], Door['ph'][0], Door['ph'][0], Door['ph'][0]];
    const I3 = p3.tI;
    const y = this.yah.map((s) => s.t0);
    const u = this.pass.u;
    const inField = t >= I3;

    // ---- the door
    const hits = [p1.tI, p2.tI, I3, p4.tI];
    const flare = Math.max(...hits.map((h) => pulse(t, h, 0.16))) * 1.4 + Math.max(...y.slice(0, 3).map((h) => pulse(t, h, 0.07))) * 0.9;
    u.open!.value = keys(t, this.kOpen);
    u.dist!.value = keys(t, this.kDist);
    // the leak breathes with the voice in the a cappella bars
    u.leak!.value = keys(t, this.kLeak) * (0.75 + 0.5 * f.a.vocal);
    u.bright!.value = 1;
    u.flare!.value = flare;
    u.t!.value = t;
    // ---- the field, after the door has opened all the way
    const fieldK = prog(t, I3 + 0.05, I3 + 0.32, ease.outCubic);
    u.field!.value = fieldK;
    // level: rose at first, a step up on I4 and on each of the last three yahs, paper at the cut
    const steps: [number, number][] = [[I3, 0.55], [p4.tI, 0.65], [y[3]!, 0.75], [y[4]!, 0.84], [y[5]!, 0.93]];
    let level = 0.55;
    for (const [ts, v] of steps) if (t >= ts) level = v + 0.05 * pulse(t, ts, 0.12) + 0.012 * (t - ts);
    u.level!.value = level;
    u.day!.value = prog(t, y[5]! + 0.25, end - 0.02, ease.inOutCubic);
    // (revision 10b) the door opens on the hit and the camera goes through it: only then is the frame
    // all light and the entity there
    // (revision 12b: back to the original — the door is all but shut, and on the hit the light and the
    // entity are simply there)
    const through = inField ? 1 : 0;
    u.through!.value = through;
    this.pass.render(this.ctx.renderer, out);

    // ---- behind the door (revision 5): the entity. It unfolds out of the slit — rings seen edge-on as
    // one line of light turn open into a gyroscope of liquid gold around a white core; on the fourth I
    // its eyes open; each yah it pulses and the camera cuts
    if (inField) {
      const day = u.day!.value;
      const agi = p4.syls.slice(-3);
      const tI = agi[2]!.t0;
      const ys = y.slice(3);
      let pulseK = 0.8 * pulse(t, tI, 0.2), cut = -1;
      ys.forEach((h, i) => { pulseK = Math.max(pulseK, pulse(t, h, 0.16)); if (t >= h) cut = i; });
      const unfold = ease.inOutCubic(clamp((t - I3) / 1.3));
      const cams: [number, number, number][] = [[0.0, -1.6, 9.0], [-2.6, -0.8, 6.4], [2.2, 1.6, 6.0], [0.0, -2.6, 5.2]];
      const cp = cams[cut + 1]!;
      const since = t - (cut >= 0 ? ys[cut]! : I3);
      this.ent.render(this.ctx, out, {
        t, unfold, spin: (t - I3) * 0.5 + 0.25 * Math.max(0, cut + 1), eyes: ease.outCubic(clamp((t - tI) / 0.35)), pulse: pulseK,
        level: lerp(0.32, 0.9, prog(t, I3, end, ease.inQuad)), scale: lerp(1.0, 1.25, prog(t, I3, end, ease.linear)),
        cam: { pos: [cp[0] * (1 - since * 0.04), cp[1], cp[2] - since * 0.5], target: [0, 0.3, 0] },
        opacity: (1 - day) * through,
      });
    }

    // ---- the words: the smallest type in the video
    const c = this.L.ctx; this.L.clear();
    c.textBaseline = 'alphabetic';
    const lit = inField; // the readouts turn to ink once the frame is light
    const ink = lit ? 'ink' : 'paper';
    // ---- the person: a silhouette on the floor between us and the door, standing in its light.
    // (projection matches the shader: focal 1.15, camera 1 unit above the floor, horizon offset 0.13)
    // (once the door has swung open the camera rushes past them: they fade out over that tenth of a second
    // rather than growing to fill the frame)
    const pass = inField ? 0 : 1;
    if (pass > 0) {
      const Z = keys(t, this.kDist) - 1.0; // 1 unit in front of the door
      if (Z > 0.8) {
        const proj = (X: number, Y: number) => {
          const px = (X * 1.15) / Z, py = ((Y - 1.0) * 1.15) / Z - 0.13;
          return [(px / (16 / 9) + 0.5) * W, (0.5 - py) * H] as const;
        };
        const [fx, fy] = proj(0.18, 0), [, hy] = proj(0.18, 1.72);
        const pose = poseAt(t, [[this.ctx.start, 'stand'], [p1.tI, 'lookUp'], [p2.tI, 'lookUp'], [y[2]! + 0.3, 'stand'], [p3.syls[0]!.t0, 'lookUp']]);
        const lc2 = this.L.ctx;
        drawFigure(lc2, fx, fy, fy - hy, pose, { col: rgba('ink', 1), style: 'fill', alpha: pass });
        // rim of light along the body's edge: the outline, faint, in the door's colour
        drawFigure(lc2, fx, fy, fy - hy, pose, { col: rgba('dawn', 0.35 * pass * clamp(u.open!.value * 6 + u.leak!.value * 0.3)), lw: Math.max(1, (fy - hy) * 0.006) });
      }
    }
    // the subtitles and the corner readouts go on the overlay: the mandala's mirrors must not swallow them
    this.ctx.comp.draw(this.ctx.renderer, this.L.upload(), out);
    const h = hudBegin();
    if (inField && u.through!.value >= 0.5 && t < y[3]!) {
      // through the door: the person small on the light, watching, until the last "Feel the AGI" is
      // over (on the overlay, so the mandala's mirrors leave them whole); gone for the last yahs
      drawFigure(h, W / 2, H - 190, 120, POSE.lookUp!, { col: rgba('ink', 1), style: 'fill' });
    }
    h.textBaseline = 'alphabetic';
    this.drawType(h, t, lit, ink, I3, start, lyrics);
    void c;
    return this.post(f, inField);
  }

  private drawType(c: CanvasRenderingContext2D, t: number, inField: boolean, ink: 'ink' | 'paper', I3: number, start: number, lyrics: Lyrics) {
    const [, , p3, p4] = this.ph as [Door['ph'][0], Door['ph'][0], Door['ph'][0], Door['ph'][0]];
    const fam = F.mono(400), size = 26;
    const cur = [...this.ph].reverse().find((p) => t >= p.syls[0]!.t0 - 0.001);
    // a phrase gives way as soon as the yahs come in (they share the line)
    const yahOn = this.yah.some((s, i) => (i % 3 === 0) && t >= s.t0 && t < this.yah[i + 2]!.t1 + 0.3);
    if (cur && !yahOn && t < cur.line.end + 0.5 && (cur !== p3 || t < I3) && (t < I3 || cur === p4)) {
      const parts = cur.syls.map((s) => s.ch.toLowerCase());
      const gap = 28;
      const widths = parts.map((p) => measure(p, fam, size));
      const total = widths.reduce((a, b) => a + b, 0) + gap * (parts.length - 1);
      let x = W / 2 - total / 2;
      c.font = font(fam, size);
      cur.syls.forEach((s, i) => {
        if (t >= s.t0) {
          const isI = i === cur.syls.length - 1;
          c.fillStyle = rgba(isI && !inField ? 'dawn' : ink, t < s.t0 + 0.12 ? 1 : 0.82);
          c.fillText(parts[i]!, x, H - 118);
        }
        x += widths[i]! + gap;
      });
    }
    // yah: three marks, struck one by one
    const yset = t < I3 ? this.yah.slice(0, 3) : this.yah.slice(3);
    if (t >= yset[0]!.t0 && t < yset[2]!.t1 + 0.3) {
      c.font = font(fam, size);
      const w = measure('yah', fam, size), gap = 44;
      let x = W / 2 - (3 * w + 2 * gap) / 2;
      for (const s of yset) {
        if (t >= s.t0) { c.fillStyle = rgba(ink, t < s.t0 + 0.12 ? 1 : 0.82); c.fillText('yah', x, H - 118); }
        x += w + gap;
      }
    }
    // annotation + clock (the clock turns over at the moment the door opens)
    const a = smoothstep(start + 0.3, start + 1.0, t);
    c.font = font(F.mono(500), 13); c.letterSpacing = '3px';
    c.fillStyle = rgba(inField ? 'ink' : 'ash', 0.7 * a);
    c.fillText('FEEL THE AGI', M, M + 6);
    c.letterSpacing = '0px';
    c.font = font(F.mono(400), 13);
    c.fillStyle = rgba(inField ? 'ink' : 'graphite', (inField ? 0.6 : 1) * a);
    c.fillText('06  door', M, M + 28);
    drawClock(c, lyrics, t, inField ? 'day' : 'night', a);
  }

  private post(f: Frame, inField: boolean): PostOverrides {
    const t = f.t;
    const [p1, p2, p3, p4] = this.ph as [Door['ph'][0], Door['ph'][0], Door['ph'][0], Door['ph'][0]];
    const I3 = p3.tI;
    const y = this.yah.map((s) => s.t0);
    // ---- post: the void has no grain and no vignette; the hits shake it
    const o: PostOverrides = { bloom: inField ? 0.35 : lerp(1.0, 0.6, smoothstep(20, 6, keys(t, this.kDist))), bloomThreshold: 1.0, bloomKnee: 0.3, bloomRadius: 0.85, halation: inField ? 0.1 : 0.45, vignette: inField ? 0.12 : 0.0, grain: inField ? 0.05 : 0.018, ca: 0.5 };
    const sub = t < p1.syls[0]!.t0 ? f.a.low : 0; // the opening 808 trembles an empty frame
    let shake = 3.5 * sub + 16 * pulse(t, p1.tI, 0.07) + 10 * pulse(t, p2.tI, 0.06) + 26 * pulse(t, I3, 0.09) + 8 * pulse(t, p4.tI, 0.06);
    for (const s of this.yah) shake += 6 * pulse(t, s.t0, 0.045);
    if (shake > 0.05) o.shake = [noise1(t * 60, 1) * shake, noise1(t * 60, 2) * shake];
    o.flash = 0.05 * pulse(t, p1.tI, 0.06) + 0.9 * pulse(t, I3, 0.11) + 0.12 * Math.max(...y.slice(3).map((h) => pulse(t, h, 0.07)));
    if (BOLD && inField) {
      // experimental cut: the entity becomes an 8-fold mandala as it unfolds; it lets go at daylight
      // a hard cut into the mandala on the first beat after the rings have opened (no warping in), and it
      // stays to the end — the frame goes to light and the next cut takes it away (no warping out)
      const au = this.ctx.audio;
      const tK = au.timeOfBeat(Math.ceil(au.beatAt(I3 + 0.9)));
      o.kaleido = 8;
      o.kaleidoMix = t >= tK ? 1 : 0;
    }
    return o;
  }
}
