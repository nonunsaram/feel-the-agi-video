// A small three.js stage for the verse's 3D objects (revision 4): a perspective camera, an
// image-based "dawn studio" environment so metals read as polished gold, and helpers for gold, paper and
// wireframe materials. Scenes build their objects once in init() and pose them per frame from song time
// (pure function of t), then call render().
import * as THREE from 'three';
import { HEX, LIN } from '../engine/palette';
import type { SceneCtx } from '../engine/scene';

/** Equirectangular studio: dark, with soft bands of dawn and two white softboxes. */
function studioCanvas(day: boolean) {
  const w = 1024, h = 512;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d')!;
  const g = c.createLinearGradient(0, 0, 0, h);
  if (day) {
    g.addColorStop(0, '#F6F2EA'); g.addColorStop(0.45, '#FFE9C2'); g.addColorStop(0.52, '#FFC46B'); g.addColorStop(0.6, '#C9B9A2'); g.addColorStop(1, '#5A5550');
  } else {
    g.addColorStop(0, '#05060A'); g.addColorStop(0.36, '#1A1B4A'); g.addColorStop(0.47, '#FF3D6E'); g.addColorStop(0.5, '#FFB648');
    g.addColorStop(0.53, '#FFE3AE'); g.addColorStop(0.58, '#2A1A14'); g.addColorStop(1, '#020203');
  }
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  // softboxes
  c.fillStyle = day ? 'rgba(255,255,255,0.95)' : 'rgba(255,240,220,0.9)';
  c.fillRect(w * 0.2, h * 0.12, w * 0.05, h * 0.32);
  c.fillRect(w * 0.68, h * 0.18, w * 0.03, h * 0.26);
  c.fillStyle = 'rgba(255,200,120,0.85)';
  c.fillRect(w * 0.44, h * 0.08, w * 0.12, h * 0.02);
  return cv;
}

export class Stage3D {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 200);
  env: THREE.Texture | null = null;
  gold!: THREE.MeshStandardMaterial;
  goldRough!: THREE.MeshStandardMaterial;
  paper!: THREE.MeshStandardMaterial;
  ink!: THREE.MeshStandardMaterial;
  /** Horizontal pixel offset of the projection centre (positive = objects appear to the right). */
  shiftX = 0;

  constructor(private ctx: SceneCtx, public day = false) {
    const pm = new THREE.PMREMGenerator(ctx.renderer);
    const tex = new THREE.CanvasTexture(studioCanvas(day));
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.env = pm.fromEquirectangular(tex).texture;
    tex.dispose(); pm.dispose();
    this.scene.environment = this.env;
    this.gold = new THREE.MeshStandardMaterial({ color: new THREE.Color(1.0, 0.72, 0.36), metalness: 1, roughness: 0.16, envMapIntensity: day ? 1.0 : 1.6 });
    this.goldRough = new THREE.MeshStandardMaterial({ color: new THREE.Color(1.0, 0.7, 0.35), metalness: 1, roughness: 0.42, envMapIntensity: 1.3 });
    this.paper = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(...LIN.paper), metalness: 0, roughness: 0.75, envMapIntensity: day ? 1.0 : 0.5 });
    this.ink = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(...LIN.ink2), metalness: 0.3, roughness: 0.5 });
    const key = new THREE.DirectionalLight(0xffffff, day ? 1.2 : 1.6);
    key.position.set(-3, 5, 6);
    this.scene.add(key, new THREE.AmbientLight(0xffffff, day ? 0.6 : 0.15));
  }

  /** Thin edge lines of a geometry (the wireframe look): gold at night, ink by day. */
  edges(geo: THREE.BufferGeometry, opacity = 0.9, color?: string, angle = 25) {
    const col = color ?? (this.day ? HEX.ink : HEX.dawn);
    const m = new THREE.LineBasicMaterial({ color: new THREE.Color(col), transparent: true, opacity, depthWrite: false });
    return new THREE.LineSegments(new THREE.EdgesGeometry(geo, angle), m);
  }

  /** A canvas texture (sRGB) for labels and faces on objects. */
  static canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    draw(cv.getContext('2d')!);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }

  /** Render the stage over `out` (keeps its colour, clears depth). */
  render(out: THREE.WebGLRenderTarget) {
    const r = this.ctx.renderer;
    const cam = this.camera;
    if (this.shiftX) cam.setViewOffset(1920, 1080, -this.shiftX, 0, 1920, 1080);
    else cam.clearViewOffset();
    cam.updateProjectionMatrix();
    r.setRenderTarget(out);
    r.clearDepth();
    r.render(this.scene, cam);
  }

  /** Point the camera from `pos` at `target`. */
  look(pos: [number, number, number], target: [number, number, number], fov?: number) {
    this.camera.position.set(...pos);
    this.camera.lookAt(...target);
    if (fov) this.camera.fov = fov;
  }
}

/** Deterministic projectile: position after time s of a body launched with v under gravity g, bouncing off y = floor. */
export function ballistic(p0: number, v: number, g: number, s: number, floor = -Infinity, restitution = 0.35) {
  let p = p0, vel = v, left = s;
  for (let k = 0; k < 6 && left > 0; k++) {
    // time to hit the floor: p + vel*t - g/2 t² = floor
    const a = -g / 2, b = vel, c = p - floor;
    const disc = b * b - 4 * a * c;
    const th = floor === -Infinity || disc < 0 ? Infinity : (-b - Math.sqrt(disc)) / (2 * a);
    if (th > left || th <= 1e-6) return p + vel * left - (g / 2) * left * left;
    p = floor; vel = -(vel - g * th) * restitution; left -= th;
    if (Math.abs(vel) < 0.05) return floor;
  }
  return p;
}
