// END — the outro (instrumental): a boom, synth stabs, two hits, five hits, stop.
// The shutter from "폐업" is down: black. A hairline horizon ignites on the boom and the sky climbs
// the dawn ramp over the stabs. The prompt from the hook is still waiting; now the reply types itself:
// "다 왔다." The two hits stamp it. The last five hits spell FEEL / THE / A / G / I — the I a bar of
// daylight — and the frame cuts to black with the last sample.
import type * as THREE from 'three';
import { BOLD } from '../engine/scale';

import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, W, H } from '../engine/gl';
import { rgba } from '../engine/palette';
import { F, font, measure } from '../engine/type';
import { clamp, ease, lerp, noise1, prog, pulse, smoothstep } from '../engine/util';
import { Glitch, Light, Sky, M, burst, caretBlink, drawCaret } from './_kit';
import { drawClock } from './_clock';
import { drawFigure, poseAt } from './_figure';
import { Liquid } from './_liquid';
import { Entity } from './_entity';

/** A small agent in silhouette: a soft capsule with a little antenna (the 3D agents' outline). */
function drawAgent(c: CanvasRenderingContext2D, x: number, y: number, h: number, bob: number, col: string) {
  const w = h * 0.62, bh = h * 0.86, lift = bob * h;
  c.save(); c.fillStyle = col; c.strokeStyle = col;
  c.beginPath(); c.roundRect(x - w / 2, y - bh - lift, w, bh, w / 2); c.fill();
  c.lineWidth = Math.max(1.5, h * 0.03); c.beginPath(); c.moveTo(x, y - bh - lift); c.lineTo(x, y - h - lift); c.stroke();
  c.beginPath(); c.arc(x, y - h - lift, h * 0.055, 0, Math.PI * 2); c.fill();
  c.restore();
}

export default class End extends Scene {
  L = new Layer2D();
  light = new Light();
  sky = new Sky();
  glitch = new Glitch();
  two: number[] = [];
  five: number[] = [];
  tStop = 0;
  ent = new Entity();
  liqs = ['FEEL', 'THE', 'A', 'G', 'I'].map((w) => new Liquid(w, F.archivo(w.length > 1 ? 100 : 125, 900)));

  override init() {
    const { audio: au, start, end } = this.ctx;
    // the hits, from the drum analysis (kicks are the body of each hit)
    const ks = au.events('kick', start + 1.5, end).map((e) => e[0]);
    const groups: number[][] = [];
    for (const k of ks) { const g = groups[groups.length - 1]; if (g && k - g[g.length - 1]! < 0.6) g.push(k); else groups.push([k]); }
    const g2 = groups.find((g) => g[0]! > start + 2.5 && g[0]! < end - 2.5) ?? [start + 3.38, start + 3.79];
    const g5 = groups[groups.length - 1] && groups[groups.length - 1]![0]! > end - 2 ? groups[groups.length - 1]! : [end - 1.21, end - 1.0, end - 0.8, end - 0.59, end - 0.37];
    this.two = [g2[0]!, g2[Math.min(2, g2.length - 1)] ?? g2[0]! + 0.41];
    this.five = [0, 1, 2, 3, 4].map((i) => g5[i] ?? g5[g5.length - 1]! + 0.205 * (i - g5.length + 1));
    this.tStop = end - 0.03;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { start, end, lyrics } = this.ctx;
    const c = this.L.ctx; this.L.clear();
    const lc = this.light.ctx; this.light.clear();
    c.textBaseline = 'alphabetic';
    const [h1, h2] = this.two as [number, number];
    const five = this.five;
    const inFive = t >= five[0]! - 0.001;

    // ---- sky: ignites on the boom, climbs with every stab, jumps on the hits
    const climb = prog(t, start, five[0]!, ease.inOutQuad);
    let level = lerp(0.1, 0.62, climb) + 0.05 * f.a.other + 0.1 * pulse(t, h1, 0.2) + 0.1 * pulse(t, h2, 0.2);
    five.forEach((h, i) => { if (t >= h) level = 0.66 + i * 0.08 + 0.05 * pulse(t, h, 0.08); });
    const ignite = prog(t, start, start + 0.35, ease.outExpo);
    this.sky.render(this.ctx, out, { level: level * ignite, horizon: 0.24, glow: 1, day: 0 });
    // the entity returns as the sun: small and far, rising from the horizon over the outro; at the five
    // hits it comes close and fills the frame behind the words
    const rise = ease.outCubic(prog(t, start, five[0]!, ease.linear));
    const close = inFive ? ease.inOutCubic(clamp((t - five[0]!) / Math.max(0.2, this.tStop - five[0]!))) : 0;
    this.ent.render(this.ctx, out, {
      t, unfold: 1, spin: t * 0.4, eyes: 1, pulse: Math.max(pulse(t, h1, 0.15), pulse(t, h2, 0.15), ...five.map((h) => pulse(t, h, 0.1))),
      level: level * ignite, scale: 1,
      cam: { pos: [lerp(-7, 0, close), lerp(0.5, 0, close), lerp(34, 9, close)], target: [lerp(-7, 0, close), lerp(lerp(7.5, 2.4, rise), 0, close), 0] },
      opacity: ignite * (t >= five[4]! ? 1 - ease.outCubic(clamp((t - five[4]!) / 0.1)) : 1), rays: 0.35 + 0.65 * close,
    });

    // ---- the prompt, and the reply
    const px = M + 48, py = H * 0.5 + 10;
    if (!inFive) {
      // no type here: only the entity rising and the person watching it
    } else {
      // ---- FEEL / THE / A / G / I
      const words = ['FEEL', 'THE', 'A', 'G', 'I'];
      let cur = 0;
      five.forEach((h, i) => { if (t >= h) cur = i; });
      const h = five[cur]!;
      const k = ease.outExpo(clamp((t - h) / 0.12));
      const fam0 = F.archivo(125, 900);
      // each hit throws the word up in liquid light: it lands from a splash (melt 1 → 0) and the camera
      // cuts to a new angle; the last I is a column of light rising like the sun
      const liq = this.liqs[cur]!;
      const cams: [number, number, number][] = [[-0.7, -0.35, 6.0], [0.8, 0.4, 6.0], [-0.6, 0.5, 6.2], [0.7, -0.3, 6.0], [0.0, -0.2, 6.6]];
      const melt = 1 - ease.outCubic(clamp((t - h) / 0.22));
      const cp = cams[cur]!;
      const drift = (t - h) * 0.6;
      liq.render(this.ctx, out, {
        t, level: 0.66 + cur * 0.08, n: 5, spread: lerp(2.6, 1.6, k), radius: 0.45 * (0.4 + melt), speed: 1.4, amp: 0.4 + 1.6 * melt,
        letters: 1, melt, letterHeight: cur < 2 ? 3.1 : 3.8, depth: 0.45,
        letterPos: [0, cur === 4 ? lerp(-1.0, 0.4, ease.outExpo(clamp((t - h) / 0.3))) : 0, 0], center: [0, 0, -1.0],
        cam: { pos: [cp[0] + drift * Math.sign(cp[0] || 1), cp[1], cp[2] - drift], target: [0, 0, 0], fov: 1.5 },
        background: 0, exposure: cur === 4 ? 1.1 : 1,
      });
      if (cur === 4) {
        // the I holds a moment; then the light comes up from the horizon and fills the frame to white
        // with the last sample
        const up = ease.inCubic(clamp((t - h - 0.12) / Math.max(0.05, this.tStop - h - 0.12)));
        if (up > 0) {
          const hy = H * 0.76, top = lerp(hy, -H * 0.3, up);
          const g = lc.createLinearGradient(0, top - 260, 0, top + 40);
          g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,1)');
          lc.fillStyle = g; lc.fillRect(0, top - 260, W, 300);
          lc.fillStyle = 'rgba(255,255,255,1)'; lc.fillRect(0, top + 39, W, H - top);
        }
      }
      void fam0; void measure;
    }

    // ---- the person: on the horizon, back to us, watching it come up; standing with a small agent beside them
    {
      const hy = H * 0.76 + 1;
      // they watch it rise; on the hits they sit down cross-legged beside a small agent: the two of them together at the end
      const keys: [number, string][] = [[start, 'stand'], [start + 1.4, 'lookUp'], [h1, 'crossLegged']];
      if (!inFive || t >= five[4]!) {
        const x = inFive ? W / 2 + 330 : W - M - 260, fh = inFive ? 230 : 170;
        drawFigure(c, x, hy, fh, poseAt(t, keys), { col: rgba('ink', 1), style: 'fill' });
        const bob = Math.abs(Math.sin(Math.PI * f.beat)) * 0.04;
        drawAgent(c, x + fh * 0.46, hy, fh * 0.42, bob, rgba('ink', 1));
      }
    }

    // ---- furniture
    const a = 0; // the outro has no type
    c.font = font(F.mono(500), 13); c.letterSpacing = '3px';
    c.fillStyle = rgba('ash', 0.75 * a);
    c.fillText('FEEL THE AGI', M, M + 6);
    c.letterSpacing = '0px';
    c.font = font(F.mono(400), 13); c.fillStyle = rgba('graphite', a);
    c.fillText('08  arrival', M, M + 28);
    drawClock(c, lyrics, t, 'night', a);

    // ---- composite
    const hitK = Math.max(burst(t, start, 5), burst(t, h1, 3), burst(t, h2, 3), ...five.map((h) => burst(t, h, 2)));
    this.glitch.draw(this.ctx, this.L.upload(), out, t, { split: 12 * hitK, slice: 0.5 * hitK, keystone: 0 });
    const lastI = t >= five[4]!;
    this.glitch.draw(this.ctx, this.light.layer.upload(), out, t, { mode: 'add', tint: [1, 0.78, 0.42], gain: lastI ? 3.4 : 2.6 });

    const o: PostOverrides = { bloom: 0.9, bloomThreshold: 1.0, bloomKnee: 0.2, bloomRadius: 0.8, halation: 0.35, vignette: 0.4, grain: 0.055, ca: 0.7 };
    let shake = 20 * pulse(t, start, 0.1) + 12 * pulse(t, h1, 0.06) + 12 * pulse(t, h2, 0.06);
    for (const h of five) shake += 12 * pulse(t, h, 0.05);
    if (shake > 0.05) o.shake = [noise1(t * 60, 1) * shake, noise1(t * 60, 2) * shake];
    o.flash = 0.15 * pulse(t, start, 0.06) + (lastI ? 0.9 * prog(t, five[4]! + 0.3, this.tStop, ease.inCubic) : 0);
    // cut to black with the last sample
    if (BOLD && inFive) {
      // experimental cut: each of the five hits flips the frame negative and mirrors it
      const cur = five.filter((h) => t >= h).length - 1;
      if (cur < 4) { o.invert = cur % 2 ? 1 : 0; }
      // (no mirror on the last I: it must read)
    }
    if (t >= this.tStop) o.fade = 1;
    return o;
  }
}
