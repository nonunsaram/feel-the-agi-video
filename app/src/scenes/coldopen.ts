// COLD OPEN — the first second, before the whisper: three flashes from the climax, so the first
// frame of the video (its thumbnail, its first impression in a feed) is the liquid AGI.
//   0.00–0.30  liquid AGI, gold, close           0.30–0.62  black; the person before the slit of light
//   0.62–0.95  liquid AGI melting, another angle  0.95–end    black (the whisper's caret takes over)
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, W, H, clearRT } from '../engine/gl';
import { LIN, rgba } from '../engine/palette';
import { Liquid } from './_liquid';
import { Light } from './_kit';
import { POSE, drawFigure } from './_figure';
import { clamp, ease } from '../engine/util';

export default class ColdOpen extends Scene {
  liq = new Liquid();
  L = new Layer2D();
  light = new Light();

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    clearRT(this.ctx.renderer, out, LIN.ink);
    if (t < 0.3 || (t >= 0.62 && t < 0.95)) {
      const second = t >= 0.62;
      const lt = second ? t - 0.62 : t;
      this.liq.render(this.ctx, out, {
        t: 40 + t, level: second ? 0.8 : 0.62, n: 6, spread: 1.7, radius: 0.5, speed: 1.2, amp: second ? 1.4 : 0.5,
        letters: 1, melt: second ? 0.5 + lt : 0, letterHeight: 3.4, depth: 0.45, center: [0, 0.1, -0.6],
        cam: second ? { pos: [-0.5 + lt * 0.8, 0.2, 5.2], target: [0, 0, 0], fov: 1.5 } : { pos: [1.1 - lt * 0.8, 0.5, 6.2 - lt * 2], target: [0, 0.1, 0], fov: 1.45 },
        background: 1,
      });
      return { bloom: 0.5, bloomThreshold: 1.0, vignette: 0.3, grain: 0.05, ca: 0.6, flash: second ? 0.35 * Math.pow(0.5, lt / 0.04) : 1.25 * (1 - ease.inOutCubic(clamp(t / 0.18))) };
    }
    if (t >= 0.3 && t < 0.62) {
      const c = this.L.ctx; this.L.clear();
      const lc = this.light.ctx; this.light.clear();
      const k = ease.outExpo(clamp((t - 0.3) / 0.25));
      const sw = 30 + 90 * k, top = H * 0.16, bot = H * 0.8;
      lc.fillStyle = '#fff';
      lc.fillRect(W / 2 - sw / 2, top, sw, bot - top);
      // its light on the floor, widening toward us
      const g = lc.createLinearGradient(0, bot, 0, H);
      g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0.05)');
      lc.fillStyle = g;
      lc.beginPath(); lc.moveTo(W / 2 - sw / 2, bot); lc.lineTo(W / 2 + sw / 2, bot); lc.lineTo(W / 2 + sw * 4, H); lc.lineTo(W / 2 - sw * 4, H); lc.fill();
      drawFigure(c, W / 2, H * 0.93, 520, POSE.lookUp!, { col: rgba('ink', 1), style: 'fill' });
      this.light.draw(this.ctx, out, 4, 'dawn');
      this.ctx.comp.draw(this.ctx.renderer, this.L.upload(), out);
    }
    return { bloom: 1.0, bloomThreshold: 1.0, vignette: 0.4, grain: 0.04, ca: 0.5 };
  }
}
