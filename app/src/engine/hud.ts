// Global overlay layer, composited by Post after its warps (kaleidoscope, shake, smear) and before the
// tone shoulder. The video runs full-bleed with no persistent overlay; a scene whose type must survive
// those warps (the build-up's subtitles under the mandala) draws it here with hudBegin().
import { Layer2D } from './gl';

export class Hud {
  static current: Hud | null = null;
  layer = new Layer2D();
  private dirty = false;
  private shown = true; // the first frame uploads a cleared layer
  constructor() { Hud.current = this; }
  /** Clear the layer and hand out its context for this frame (the last caller in a frame wins). */
  begin() { this.layer.clear(); this.dirty = true; return this.layer.ctx; }
  draw(_t: number, _opacity: number) {
    if (this.dirty) { this.dirty = false; this.shown = true; return this.layer.upload(); }
    if (this.shown) { this.shown = false; this.layer.clear(); return this.layer.upload(); }
    return this.layer.texture;
  }
}

/** The overlay's 2D context for the current frame (cleared). */
export function hudBegin() { return Hud.current!.begin(); }
