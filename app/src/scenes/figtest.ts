// Dev-only: a pose sheet for the pictogram figure (not in the timeline unless ?only=figtest).
import type * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { LIN } from '../engine/palette';
import { POSE, drawFigure, waving } from './_figure';

export default class FigTest extends Scene {
  L = new Layer2D();
  render(_f: Frame, out: THREE.WebGLRenderTarget) {
    clearRT(this.ctx.renderer, out, LIN.ink);
    const c = this.L.ctx; this.L.clear();
    const names = Object.keys(POSE);
    [0, 0.06, 0.12, 0.18, 0.24, 0.3].forEach((u, i) => drawFigure(c, 140 + i * 260, 1060, 300, waving(1 + u, 0.5), { col: '#F1EEE6', lw: 5 }));
    names.forEach((n, i) => {
      const x = 140 + (i % 7) * 260, y = 480 + Math.floor(i / 7) * 480;
      drawFigure(c, x, y, 330, POSE[n]!, { col: '#F1EEE6', style: i === 12 ? 'fill' : 'line', lw: 5 });
      c.font = '20px monospace'; c.fillStyle = '#8E919B'; c.fillText(n, x - 50, y + 40);
    });
    this.ctx.comp.draw(this.ctx.renderer, this.L.upload(), out);
  }
}
