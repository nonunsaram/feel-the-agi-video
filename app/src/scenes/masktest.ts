// Dev-only (?only=masktest): one mask, intact and cracking.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { clearRT } from '../engine/gl';
import { LIN } from '../engine/palette';
import { Stage3D } from './_stage3d';
import { Mask } from './_objects3d';

export default class MaskTest extends Scene {
  st!: Stage3D; mk!: Mask;
  override init() { this.st = new Stage3D(this.ctx, false); this.mk = new Mask(this.st, 1); this.st.scene.add(this.mk.group); }
  render(f: Frame, out: THREE.WebGLRenderTarget) {
    clearRT(this.ctx.renderer, out, LIN.ink);
    this.mk.pose(f.t * 1000 - 1.5); // t=0.001 → intact, 0.0018 → 0.3 s after the crack
    this.st.look([0.6, 0.3, 3.2], [0, 0, 0], 30);
    this.st.render(out);
  }
}
