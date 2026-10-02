// Dev-only: liquid light test (?only=liqtest). Variant by t: 0 = blobs, 1 = letters, 2 = letters melting.
import type * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { clearRT } from '../engine/gl';
import { LIN } from '../engine/palette';
import { Liquid } from './_liquid';

export default class LiqTest extends Scene {
  liq = new Liquid();
  render(f: Frame, out: THREE.WebGLRenderTarget) {
    clearRT(this.ctx.renderer, out, LIN.ink);
    const v = Math.round(f.t * 1000) % 3;
    this.liq.render(this.ctx, out, {
      t: 3.3, level: [0.55, 0.7, 0.85][v]!, n: 8, spread: v === 0 ? 1.6 : 1.9, radius: 0.95,
      letters: v === 0 ? 0 : 1, melt: v === 2 ? 0.6 : 0, letterHeight: 3.2, depth: 0.5,
      cam: { pos: [1.2, 0.9, 6.2], target: [0, 0, 0], fov: 1.45 }, background: 1, ground: v === 2 ? 1 : 0, groundY: -1.4,
    });
  }
}
