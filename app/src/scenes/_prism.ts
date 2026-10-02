// The prism world (revision 8): the one bright place in the middle of the night. A light-grey studio
// with no horizon, a glass prism (real transmission with dispersion), a beam of white light coming in
// from the left and a spectrum fanning out of it to the right and across the floor. Hook 3 opens by
// breaking it: the prism shatters and its shards — small triangles of coloured glass — drift through
// the dawn sky. Pure functions of the parameters passed in.
import * as THREE from 'three';
import type { SceneCtx } from '../engine/scene';
import { Stage3D } from './_stage3d';
import { hash } from '../engine/util';

/** The spectrum, red to violet (sRGB hex). */
export const SPECTRUM = ['#FF2D55', '#FF8A00', '#FFD60A', '#30D158', '#0A84FF', '#5E5CE6'];
export const BG = '#E9E7E2';
const FLOOR = -2.3;

export interface PrismParams {
  /** prism turn about its long axis (radians), and the whole stage's camera */
  turn: number;
  cam: { pos: [number, number, number]; target: [number, number, number]; fov?: number };
  /** 0..1 how far the spectrum has fanned out (0 = only the white beam), and its brightness */
  fan: number; glow: number;
  /** horizontal shift of the projection centre (px) */
  shiftX?: number;
  /** prism position / scale */
  pos?: [number, number, number]; scale?: number;
}

export class PrismStage {
  st: Stage3D;
  prism: THREE.Group;
  private beam: THREE.Mesh;
  private fan = new THREE.Group();
  private floorFan = new THREE.Group();
  private bands: THREE.Mesh[] = [];
  private floorBands: THREE.Mesh[] = [];

  constructor(private ctx: SceneCtx) {
    const st = (this.st = new Stage3D(ctx, true));
    const S = st.scene;
    const bg = new THREE.Color(BG);
    S.background = bg;
    S.fog = new THREE.Fog(bg, 14, 34);
    // (revision 10b) no floor and no horizon anywhere: a seamless grey cyclorama. Even the environment the
    // glass reflects and refracts is a horizon-less grey room with softboxes — a horizon seen through the
    // prism read as the prism being cut
    const ec = document.createElement('canvas'); ec.width = 1024; ec.height = 512;
    const g2 = ec.getContext('2d')!;
    g2.fillStyle = BG; g2.fillRect(0, 0, 1024, 512);
    g2.fillStyle = '#FFFFFF';
    g2.fillRect(180, 120, 70, 200); g2.fillRect(690, 150, 50, 160); g2.fillRect(430, 40, 160, 26);
    g2.fillStyle = 'rgba(120,120,128,0.5)'; g2.fillRect(840, 180, 90, 150);
    // a faint grid on the backdrop wall: something for the glass to bend, so the light can be seen passing
    // through it on the grey
    const grid = Stage3D.canvasTex(1024, 1024, (c) => {
      c.fillStyle = BG; c.fillRect(0, 0, 1024, 1024);
      c.strokeStyle = 'rgba(40,42,50,0.10)'; c.lineWidth = 2;
      for (let i = 0; i <= 1024; i += 64) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 1024); c.moveTo(0, i); c.lineTo(1024, i); c.stroke(); }
    });
    grid.wrapS = grid.wrapT = THREE.RepeatWrapping; grid.repeat.set(6, 4);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(90, 60), new THREE.MeshBasicMaterial({ map: grid, fog: false }));
    wall.position.set(0, 0, -9);
    S.add(wall);
    const et = new THREE.CanvasTexture(ec); et.mapping = THREE.EquirectangularReflectionMapping; et.colorSpace = THREE.SRGBColorSpace;
    const pm = new THREE.PMREMGenerator(ctx.renderer);
    S.environment = pm.fromEquirectangular(et).texture;
    et.dispose(); pm.dispose();
    // the prism: an equilateral triangle seen face-on, its long axis toward the camera
    const geo = new THREE.CylinderGeometry(1, 1, 2.2, 3, 1).rotateX(Math.PI / 2).rotateZ(Math.PI / 2);
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, metalness: 0, roughness: 0.02, transmission: 1, thickness: 1.6, ior: 1.52, dispersion: 6,
      specularIntensity: 1, envMapIntensity: 1.4, clearcoat: 1, clearcoatRoughness: 0.05, attenuationColor: new THREE.Color(0.95, 0.97, 1), attenuationDistance: 6,
    });
    this.prism = new THREE.Group();
    this.prism.add(new THREE.Mesh(geo, glass), st.edges(geo, 0.55, '#6E6F78'));
    S.add(this.prism);
    // the incoming beam: a hot white blade from the left edge to the prism's left face
    const bm = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.1, 3.0), transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.beam = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.05), bm);
    S.add(this.beam);
    // the spectrum: six bands fanning out of the right face, and their light thrown across the floor
    SPECTRUM.forEach((hex, i) => {
      const col = new THREE.Color(hex).multiplyScalar(1.15);
      const m = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.92, depthWrite: false, side: THREE.DoubleSide, fog: false });
      const band = new THREE.Mesh(new THREE.BufferGeometry(), m);
      this.bands.push(band); this.fan.add(band);
      const fm = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, depthWrite: false, fog: true });
      const fb = new THREE.Mesh(new THREE.BufferGeometry(), fm);
      this.floorBands.push(fb); this.floorFan.add(fb);
      void i;
    });
    S.add(this.fan);
  }

  render(out: THREE.WebGLRenderTarget, p: PrismParams) {
    const sc = p.scale ?? 1, [px, py, pz] = p.pos ?? [0, 0, 0];
    this.prism.position.set(px, py, pz);
    this.prism.scale.setScalar(sc);
    this.prism.rotation.z = p.turn;
    // the beam hits the prism's left face at its middle height
    const hitX = px - 0.5 * sc, hitY = py + 0.05 * sc;
    const len = 30;
    this.beam.scale.set(len, 1 + 0.4 * p.glow, 1);
    // coming down a little from the upper left; its right end touches the face
    const ba = -0.06;
    this.beam.rotation.z = ba;
    this.beam.position.set(hitX - Math.cos(ba) * len / 2, hitY - Math.sin(ba) * len / 2, pz);
    // the fan leaves the right face, turning with the prism
    const ox = px + 0.45 * sc, oy = py - 0.05 * sc;
    const base = -0.16 + 0.35 * Math.sin(p.turn * 1.5);
    const spread = 0.05 + 0.32 * p.fan;
    const L = 40;
    this.bands.forEach((b, i) => {
      const a0 = base - spread * (i / 6), a1 = base - spread * ((i + 1) / 6);
      // a thin wedge: from a point at the face to a wide edge far away
      const pos = new Float32Array([
        ox, oy - i * 0.012 * sc, pz, ox + Math.cos(a0) * L, oy + Math.sin(a0) * L, pz, ox + Math.cos(a1) * L, oy + Math.sin(a1) * L, pz,
        ox, oy - (i + 1) * 0.012 * sc, pz,
      ]);
      b.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      b.geometry.setIndex([0, 1, 2, 0, 2, 3]);
      b.geometry.computeBoundingSphere();
      (b.material as THREE.MeshBasicMaterial).opacity = 0.9 * Math.min(1, p.fan * 3) * p.glow;
      // on the floor: where the wedge meets the floor, a long coloured stripe toward the camera-right
      const fb = this.floorBands[i]!;
      const y0 = FLOOR + 0.001, w0 = (i - 3) * 0.06 * (0.3 + p.fan);
      const fpos = new Float32Array([
        ox + 0.5, y0, pz + w0, ox + 14, y0, pz + 3 + i * 0.9 * (0.2 + p.fan), ox + 14, y0, pz + 3 + (i + 1) * 0.9 * (0.2 + p.fan), ox + 0.5, y0, pz + w0 + 0.06,
      ]);
      fb.geometry.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
      fb.geometry.setIndex([0, 1, 2, 0, 2, 3]);
      fb.geometry.computeBoundingSphere();
      (fb.material as THREE.MeshBasicMaterial).opacity = 0.45 * p.fan * p.glow;
    });
    this.st.shiftX = p.shiftX ?? 0;
    this.st.look(p.cam.pos, p.cam.target, p.cam.fov ?? 30);
    // the backdrop is painted here (the stage only clears depth), and the glass's transmission pass
    // must see the same grey behind it
    const r = this.ctx.renderer, prev = r.getClearColor(new THREE.Color()), pa = r.getClearAlpha();
    r.setClearColor(new THREE.Color(BG), 1);
    r.setRenderTarget(out); r.clear(true, true, false);
    this.st.render(out);
    r.setClearColor(prev, pa);
  }
}

/**
 * The shards of the broken prism: n small triangles of tinted glass. `burst` 0..1 is how far they have
 * flown from the centre; `drift` is time since; `mode` arranges them afterwards.
 */
export class Shards {
  st: Stage3D;
  private mesh: THREE.InstancedMesh;
  private n: number;
  private m = new THREE.Matrix4(); private q = new THREE.Quaternion(); private e = new THREE.Euler();
  private v = new THREE.Vector3(); private s = new THREE.Vector3();
  constructor(ctx: SceneCtx, n = 160) {
    this.n = n;
    const st = (this.st = new Stage3D(ctx, false));
    const tri = new THREE.CylinderGeometry(0.16, 0.16, 0.025, 3, 1).rotateX(Math.PI / 2);
    const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.05, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [200, 900], envMapIntensity: 2.2, clearcoat: 1, transparent: true, opacity: 0.92 });
    this.mesh = new THREE.InstancedMesh(tri, mat, n);
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) this.mesh.setColorAt(i, col.set(SPECTRUM[i % 6]!).lerp(new THREE.Color(1, 1, 1), 0.35));
    this.mesh.frustumCulled = false;
    st.scene.add(this.mesh);
  }
  /**
   * mode 0: flying out and drifting · 1: turning into a ring around the centre · 2: falling slowly,
   * catching the light. k 0..1 blends from mode 0 to the given mode.
   */
  render(out: THREE.WebGLRenderTarget, p: { t: number; burst: number; mode: number; k: number; cam: [number, number, number]; opacity?: number; grow?: boolean }) {
    for (let i = 0; i < this.n; i++) {
      const h1 = hash(i, 1), h2 = hash(i, 2), h3 = hash(i, 3);
      const th = h1 * Math.PI * 2, ph = Math.acos(h2 * 2 - 1);
      const r = (0.4 + 5.5 * h3) * p.burst;
      let x = r * Math.sin(ph) * Math.cos(th) * 1.6, y = r * Math.cos(ph) * 0.8, z = r * Math.sin(ph) * Math.sin(th) - 1;
      x += Math.sin(p.t * 0.3 + i) * 0.15; y += Math.cos(p.t * 0.25 + i * 1.7) * 0.12;
      if (p.mode === 1) {
        const a = (i / this.n) * Math.PI * 2 + p.t * 0.6, R = 2.6 + 0.25 * Math.sin(i * 3.1);
        x += (Math.cos(a) * R * 1.3 - x) * p.k; y += (Math.sin(a) * R * 0.75 - y) * p.k; z += (-1 + 0.3 * Math.sin(i) - z) * p.k;
      } else if (p.mode === 2) {
        const fy = 4.5 - ((p.t * (0.5 + 0.5 * h1) + h2 * 9) % 9);
        x += ((h1 - 0.5) * 12 - x) * p.k; y += (fy - y) * p.k; z += ((h3 - 0.5) * 6 - 1 - z) * p.k;
      }
      this.e.set(p.t * (0.6 + h1) + i, p.t * (0.9 + h2) + i * 2, p.t * 0.4 + h3 * 6);
      this.q.setFromEuler(this.e);
      const g = (0.6 + 0.9 * h2) * (p.grow === false ? 1 : Math.min(1, p.burst * 4));
      this.m.compose(this.v.set(x, y, z), this.q, this.s.set(g, g, g));
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    (this.mesh.material as THREE.MeshPhysicalMaterial).opacity = 0.92 * (p.opacity ?? 1);
    this.st.look(p.cam, [0, 0, -1], 34);
    this.st.render(out);
  }
}
