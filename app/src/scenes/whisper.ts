// WHISPER — the intro (n = 1) and the pre-hook (n = 2): "사랑을 속삭이네 / 반짝이는 너와의 미래 /
// 느껴봐(라) 새 시대 / 새 시대".  Night, a horizon, and a caret of light that types the four lines
// syllable by syllable as they are sung. The last "새 시대" takes the whole frame; the caret beside
// it stretches into a slit from floor to ceiling — the door the build-up will open.
//   n=1  almost black: the horizon is a cold hint, the lines are set small and low like a note
//        written at 4 a.m.
//   n=2  the same words 76 s later: the sky has started (rose on the line), the type is larger and
//        holds its brightness, the drum roll makes the horizon pulse.
import type * as THREE from 'three';
import { BOLD } from '../engine/scale';

import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, W, H } from '../engine/gl';
import { rgba } from '../engine/palette';
import { F, font, measure } from '../engine/type';
import type { Line } from '../engine/lyrics';
import { clamp, ease, lerp, prog, pulse, smoothstep, noise1 } from '../engine/util';
import { Glitch, Light, Sky, M, burst, caretBlink, currentSyl, drawCaret, drawGlint, layoutWords, type LineLayout, type PlacedSyl } from './_kit';
import { beatPulse, dawnLevel, drawClock } from './_clock';
import { POSE, drawFigure, poseAt, setFigureFill } from './_figure';

export default class Whisper extends Scene {
  n = 1;
  L = new Layer2D();
  light = new Light();
  sky = new Sky();
  glitch = new Glitch();
  lines: Line[] = [];
  lays: LineLayout[] = [];
  big!: LineLayout;
  size = 92;
  lead = 138;
  x0 = M + 144;
  y0 = 0;
  tBig = 0; tRise = 0;
  fam = F.krSerif(500);

  override init() {
    const { lyrics, params, end } = this.ctx;
    this.n = Number(params.n ?? 1);
    this.lines = lyrics.section(String(params.section ?? 'intro'));
    if (this.lines.length < 4) throw new Error('whisper: expected 4 lines');
    this.size = this.n === 1 ? 128 : 150;
    this.lead = this.size * 1.5;
    this.lays = this.lines.slice(0, 3).map((l) => layoutWords(l.words, this.fam, this.size, 0.3));
    this.y0 = H * 0.5 - this.lead * 0.6;
    const last = this.lines[3]!;
    this.big = layoutWords(last.words, F.krSerif(500), 400, 0.24);
    this.tBig = last.start;
    // the caret starts to stretch into the slit over the last bar
    this.tRise = Math.max(last.words[last.words.length - 1]!.syl?.[1]?.[0] ?? last.start + 0.6, end - 1.7);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, n = this.n, { start, end } = this.ctx;
    const c = this.L.ctx; this.L.clear();
    setFigureFill('#14161D');
    const lc = this.light.ctx; this.light.clear();
    c.textBaseline = 'alphabetic';

    // ---- sky: dawn creeps up through the scene
    const roll = n === 2 ? f.a.drums * 0.05 + f.a.kick * 0.04 : 0;
    // the pre-hook is the hour just before sunrise: well above the intro's night (and far above the
    // black void of the build-up that follows, which makes the door's light hit harder)
    const level = dawnLevel(this.ctx.lyrics, t) + roll + (n === 2 ? 0.16 : 0);
    this.sky.render(this.ctx, out, { level, horizon: 0.2, glow: 1 });

    // ---- lines 1-3: one shot each, cut on the line's first syllable
    const inBig = t >= this.tBig;
    let zoom = 1, shake = 0;
    if (!inBig) {
      const i = t < this.lines[1]!.start ? 0 : t < this.lines[2]!.start ? 1 : 2;
      const r = [this.shotA, this.shotB, this.shotC][i]!.call(this, c, lc, f);
      zoom = r.zoom; shake = r.shake;
    }

    // ---- the last "새 시대": full frame
    if (inBig) {
      const lay = this.big;
      const x = (W - lay.width) / 2 - 40, y = H * 0.5 + 430 * 0.34;
      for (const s of lay.syls) {
        if (t < s.t0) continue;
        c.font = font(s.fam, lay.size);
        const k = ease.outExpo(clamp((t - s.t0) / 0.22));
        const sc = lerp(1.12, 1, k) * (1 + 0.012 * Math.max(0, t - s.t0)); // lands, then creeps toward camera
        c.save();
        c.translate(x + s.x + s.w / 2, y - 430 * 0.36);
        c.scale(sc, sc);
        c.fillStyle = rgba('paper', 1);
        c.fillText(s.ch, -s.w / 2, 430 * 0.36);
        c.restore();
        shake = Math.max(shake, 5 * pulse(t, s.t0, 0.05));
      }
      // the caret after 대: it rises into a slit from floor to ceiling, then over the last beat its light
      // spreads sideways across the whole frame and carries the cut into the hook
      const lastS = lay.syls[lay.syls.length - 1]!;
      const cx = x + lastS.x + lastS.w + 46;
      const r = prog(t, this.tRise, end - 0.02, ease.inExpo);
      const h = lerp(400, H * 2.2, r), cy = lerp(y + 40, H + H * 0.6, r);
      const a = t >= lastS.t0 ? caretBlink(f.beat, r > 0) : 0;
      drawCaret(lc, cx, cy, h, lerp(6, 10, r), a);
      const spread = prog(t, end - 0.42, end - 0.01, ease.inCubic);
      if (spread > 0) {
        const half = lerp(10, W * 1.1, spread);
        const g = lc.createLinearGradient(cx - half, 0, cx + half, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${0.35 + 0.65 * spread})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        lc.fillStyle = g; lc.fillRect(cx - half, 0, half * 2, H);
      }
    }

    // ---- the person: small, on the horizon at the right, back to us. In the pre-hook they walk
    // toward the light and stop to look up at "새 시대"
    {
      const hy = H * 0.8 + 1, fh = n === 1 ? 120 : 150;
      let fx = W * 0.86, pose = poseAt(t, [[start, 'wait'], [this.tBig, 'lookUp'], [this.tRise, 'wave']]);
      if (n === 2 && t < this.tBig) {
        const k = clamp((t - start) / (this.tBig - start));
        fx = lerp(W * 0.66, W * 0.86, k);
        pose = Math.floor(f.beat) % 2 === 0 ? POSE.walkA! : POSE.walkB!;
      }
      drawFigure(c, fx, hy, fh, pose, { col: rgba('paper', 0.92), lw: 2.5, alpha: smoothstep(start + 0.3, start + 1.5, t) });
    }

    // ---- annotations
    const ann = smoothstep(start + 0.2, start + 1.0, t);
    c.font = font(F.mono(500), 13);
    c.letterSpacing = '3px';
    c.fillStyle = rgba('ash', 0.75 * ann);
    c.fillText('FEEL THE AGI', M, M + 6);
    c.letterSpacing = '0px';
    c.font = font(F.mono(400), 13);
    c.fillStyle = rgba('graphite', ann);
    c.fillText(n === 1 ? '00  whisper' : '05  whisper, again', M, M + 28);
    drawClock(c, this.ctx.lyrics, t, 'night', ann);

    // ---- composite
    const dropHit = n === 2 ? pulse(t, 89.6, 0.12) : 0; // the drop under the held note (pre-hook only)
    const cuts = [this.lines[1]!.start, this.lines[2]!.start, this.tBig];
    const gl = Math.max(n === 2 ? dropHit : 0, ...cuts.map((x) => burst(t, x, 2)));
    // the pre-hook opens out of the gold the caret left at the end of hook 3
    if (n === 2) { const g = 1 - ease.outCubic(clamp((t - start) / 0.24)); if (g > 0) { c.fillStyle = rgba('dawn', g); c.fillRect(0, 0, W, H); } }
    this.glitch.draw(this.ctx, this.L.upload(), out, t, { split: 10 * gl, slice: 0.5 * gl });
    this.light.draw(this.ctx, out, lerp(2.4, 5, prog(t, this.tRise, end, ease.inCubic)), 'dawn');

    const o: PostOverrides = { bloom: 0.8, bloomThreshold: 1.0, bloomKnee: 0.2, bloomRadius: 0.8, halation: 0.35, vignette: 0.5, grain: 0.06, ca: 0.6 };
    o.zoom = zoom * (1 + (inBig ? 0.02 * prog(t, this.tBig, end, ease.inCubic) : 0)) * (1 + (n === 2 && f.a.drums > 0.3 ? 0.01 * beatPulse(f.beat) : 0));
    if (shake > 0.05) o.shake = [noise1(t * 60, 1) * shake, noise1(t * 60, 2) * shake];
    if (n === 2) o.flash = 0.25 * dropHit;
    if (BOLD) {
      // experimental cut: the future rushes in through a 5-fold kaleidoscope
      const fut = this.lines[1]!.words[this.lines[1]!.words.length - 1]!.start;
      const k = smoothstep(fut, fut + 0.4, t) * (1 - smoothstep(this.lines[2]!.start - 0.25, this.lines[2]!.start, t));
      void k;
      o.smear = 160 * Math.max(...[this.lines[1]!.start, this.lines[2]!.start, this.tBig].map((x) => burst(t, x, 3)));
    }
    return o;
  }

  /** Shot A — 사랑을 속삭이네: typed in the middle of the dark; then the line breathes out — the letters
   * drift apart, breath-glints rise from them — and the camera leans in. */
  private shotA(c: CanvasRenderingContext2D, lc: CanvasRenderingContext2D, f: Frame) {
    const t = f.t, lay = this.lays[0]!, l = this.lines[0]!;
    const x0 = (W - lay.width) / 2, y = H * 0.5;
    const lastS = lay.syls[lay.syls.length - 1]!;
    const breath = ease.inOutCubic(prog(t, lastS.t0 + 0.1, this.lines[1]!.start, ease.linear));
    const mid = (lay.syls.length - 1) / 2;
    c.font = font(this.fam, lay.size);
    let caretX = x0, typing = false;
    lay.syls.forEach((s, i) => {
      if (t < s.t0) return;
      const fresh = 1 - prog(t, s.t0, s.t0 + 0.5, ease.outCubic);
      const dx = (i - mid) * 26 * breath, dy = -8 * breath * Math.sin(i * 1.3 + t * 2);
      c.fillStyle = mixCol(fresh, 1);
      c.fillText(s.ch, x0 + s.x + dx, y + dy + 6 * (1 - ease.outExpo(clamp((t - s.t0) / 0.22))));
      caretX = x0 + s.x + s.w + dx + 14; typing = t < s.t1 + 0.25;
      // breath: a few glints rise from each syllable after it is sung
      for (let k = 0; k < 4; k++) {
        const age = t - s.t0 - 0.15 - k * 0.22;
        if (age <= 0 || age > 1.8) continue;
        const gx = x0 + s.x + s.w * (0.3 + 0.4 * ((k * 37 + i * 13) % 10) / 10) + dx + 14 * Math.sin(age * 3 + k);
        const gy = y - lay.size * 0.8 - age * 95;
        const a = Math.sin(Math.PI * (age / 1.8));
        drawGlint(lc, gx, gy, 10 + 6 * a, 0.8 * a, age);
      }
    });
    if (t < l.start) caretX = (W - 6) / 2;
    if (breath < 0.3 && (this.n === 1 || t >= l.start - 0.04)) drawCaret(lc, caretX, y + lay.size * 0.14, lay.size * 1.05, 5, caretBlink(f.beat, typing) * (1 - breath / 0.3));
    return { zoom: 1 + 0.06 * breath + 0.01 * prog(t, this.ctx.start, l.start), shake: 0 };
  }

  /** Shot B — 반짝이는 너와의 미래: each syllable of 반짝이는 lands with a starburst; 미래 flies at the
   * camera and the frame fills with points of gold coming toward us (the future, arriving). */
  private shotB(c: CanvasRenderingContext2D, lc: CanvasRenderingContext2D, f: Frame) {
    const t = f.t, lay = this.lays[1]!, l = this.lines[1]!;
    const x0 = (W - lay.width) / 2, y = H * 0.5;
    const fut = l.words[l.words.length - 1]!;
    const tF = fut.start;
    let shake = 0;
    lay.syls.forEach((s) => {
      if (t < s.t0) return;
      const isTwinkle = s.word.index === 0, isFuture = s.word === fut;
      const k = ease.outExpo(clamp((t - s.t0) / 0.2));
      if (isFuture) return; // drawn below, in 3D
      c.font = font(this.fam, lay.size);
      c.fillStyle = mixCol(1 - prog(t, s.t0, s.t0 + 0.5), 1 - prog(t, tF, tF + 0.22));
      c.save(); c.translate(x0 + s.x + s.w / 2, y - lay.size * 0.35); c.scale(lerp(1.15, 1, k), lerp(1.15, 1, k));
      c.fillText(s.ch, -s.w / 2, lay.size * 0.35); c.restore();
      if (isTwinkle) {
        const d = t - s.t0;
        if (d < 0.8) { const a = Math.sin(Math.PI * clamp(d / 0.8)) ** 1.2; drawGlint(lc, x0 + s.x + s.w * 0.8, y - lay.size * 0.85, 70 * a, a, 0.3 + d); }
        shake = Math.max(shake, 3 * pulse(t, s.t0, 0.05));
      }
    });
    // 미래: from its place on the line, toward the camera
    if (t >= tF) {
      const u = t - tF;
      const sc = Math.exp(u * 1.6);
      const fs = lay.syls.filter((s) => s.word === fut);
      const fx0 = x0 + fs[0]!.x, fw = fs[fs.length - 1]!.x + fs[fs.length - 1]!.w - fs[0]!.x;
      const cx = lerp(fx0 + fw / 2, W / 2, ease.outCubic(clamp(u / 0.8))), cy = lerp(y - lay.size * 0.35, H * 0.46, ease.outCubic(clamp(u / 0.8)));
      c.save();
      c.globalAlpha = 1 - smoothstep(0.55, 1.15, u);
      c.translate(cx, cy); c.scale(sc, sc);
      fs.forEach((s) => { c.font = font(this.fam, lay.size); c.fillStyle = rgba('glow', 1); c.fillText(s.ch, s.x - fs[0]!.x - fw / 2, lay.size * 0.35); });
      c.restore();
      // the gold points: born at the centre, rushing outward (perspective), more of them as it goes
      for (let i = 0; i < 260; i++) {
        const born = (i / 260) * 2.2;
        const age = u - born;
        if (age <= 0) continue;
        const ang = (i * 2.39996) % (Math.PI * 2), z = Math.exp(age * 1.8) * (0.03 + 0.05 * ((i * 7919) % 97) / 97);
        const px = W / 2 + Math.cos(ang) * z * W * 0.5, py = H * 0.46 + Math.sin(ang) * z * H * 0.5;
        if (px < -20 || px > W + 20 || py < -20 || py > H + 20) continue;
        const r = Math.min(4, 0.6 + z * 3);
        lc.fillStyle = `rgba(255,255,255,${Math.min(1, 0.25 + z)})`;
        lc.beginPath(); lc.arc(px, py, r, 0, Math.PI * 2); lc.fill();
      }
      shake = Math.max(shake, 6 * pulse(t, tF, 0.06));
    }
    return { zoom: 1 + 0.02 * prog(t, l.start, this.lines[2]!.start), shake };
  }

  /** Shot C — 느껴봐 새 시대: 느껴봐 huge, trembling with the voice; on 새 시대 a line of light ignites
   * along the horizon from left to right. */
  private shotC(c: CanvasRenderingContext2D, lc: CanvasRenderingContext2D, f: Frame) {
    const t = f.t, l = this.lines[2]!;
    const feel = l.words[0]!, rest = l.words.slice(1);
    const big = this.c1 ??= layoutWords([feel], this.fam, this.n === 1 ? 260 : 300, 0.2);
    const sm = this.c2 ??= layoutWords(rest, this.fam, big.size, 0.24);
    const bx = M + 40, by = H * 0.43;
    const v = f.a.vocal;
    big.syls.forEach((s, i) => {
      if (t < s.t0) return;
      const k = ease.outExpo(clamp((t - s.t0) / 0.22));
      const jx = noise1(t * 38, i + 1) * 7 * v, jy = noise1(t * 41, i + 7) * 5 * v;
      c.font = font(this.fam, big.size);
      c.save(); c.translate(bx + s.x + s.w / 2 + jx, by - big.size * 0.35 + jy); c.scale(lerp(1.1, 1, k), lerp(1.1, 1, k));
      c.fillStyle = mixCol(1 - prog(t, s.t0, s.t0 + 0.6), 1);
      c.fillText(s.ch, -s.w / 2, big.size * 0.35); c.restore();
    });
    const sx = bx, sy = by + big.size * 1.15;
    let shake = 0;
    sm.syls.forEach((s) => {
      if (t < s.t0) return;
      const k = ease.outExpo(clamp((t - s.t0) / 0.18));
      c.font = font(s.fam, sm.size);
      c.save(); c.translate(sx + s.x + s.w / 2, sy - sm.size * 0.35); c.scale(lerp(1.1, 1, k), lerp(1.1, 1, k));
      c.fillStyle = mixCol(1 - prog(t, s.t0, s.t0 + 0.6), 1); c.fillText(s.ch, -s.w / 2, sm.size * 0.35); c.restore();
      shake = Math.max(shake, 5 * pulse(t, s.t0, 0.05));
    });
    // the horizon ignites
    const tN = rest[0]!.start;
    const ig = ease.outCubic(prog(t, tN, tN + 0.7, ease.linear));
    if (ig > 0) {
      const hy = H * 0.8;
      lc.fillStyle = 'rgba(255,255,255,0.9)'; lc.fillRect(0, hy - 1, W * ig, 2);
      const head = W * ig;
      const g = lc.createRadialGradient(head, hy, 0, head, hy, 46);
      g.addColorStop(0, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      lc.fillStyle = g; lc.fillRect(head - 46, hy - 46, 92, 92);
    }
    return { zoom: 1 + 0.03 * prog(t, l.start, this.tBig), shake };
  }
  c1?: LineLayout; c2?: LineLayout;
}

/** Where the caret sits while a syllable is being sung: it runs to the syllable's right edge as it lands. */
function caretTarget(lay: LineLayout, cur: PlacedSyl, t: number) {
  const k = ease.outExpo(clamp((t - cur.t0) / 0.12));
  return lerp(cur.x, cur.x + cur.w, k);
}

/** Paper type that is warm (glow) when fresh. */
function mixCol(fresh: number, a: number) {
  const p = [241, 238, 230], g = [255, 214, 140];
  const m = p.map((v, i) => Math.round(v + (g[i]! - v) * fresh));
  return `rgba(${m[0]},${m[1]},${m[2]},${a})`;
}

// (measure is re-exported for scenes that size against this one)
export const _measure = measure;
