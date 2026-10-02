// The verse's 3D objects (revision 4). Each is a THREE.Group built once and posed per frame by a pure
// function of its inputs. Materials come from a Stage3D (gold / paper / ink + wire edges).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { F, font, measure } from '../engine/type';
import { clamp, ease, hash, lerp } from '../engine/util';
import { drawFigure, type Pose } from './_figure';
import { Stage3D } from './_stage3d';

// ------------------------------------------------------------------ the person, as a billboard in 3D
export class FigureSprite {
  canvas = document.createElement('canvas');
  tex: THREE.CanvasTexture;
  sprite: THREE.Sprite;
  private key = '';
  shadow: THREE.Mesh;
  /** draw a side-view chair under the figure (for sitting poses) */
  chair = false;
  constructor(public height = 1.75, private col = '#F1EEE6', private style: 'line' | 'fill' = 'line', private fill: string | null = null) {
    this.canvas.width = 512; this.canvas.height = 512;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false }));
    this.sprite.center.set(0.5, 0.035); // the outline's lowest pixel at the origin (0.06 put the feet' outline below the floor, where it was cut)
    this.sprite.scale.set(height * 1.06, height * 1.06, 1);
    this.shadow = contactShadow(0.42 * height / 1.75, 0.55);
  }
  /** Keep the contact shadow under the feet. */
  sync() { this.shadow.position.set(this.sprite.position.x, 0.004, this.sprite.position.z); this.shadow.visible = this.sprite.visible; }
  pose(p: Pose, colour?: string) {
    const col = colour ?? this.col;
    const k = JSON.stringify(p) + col + this.chair;
    if (k === this.key) return;
    this.key = k;
    const c = this.canvas.getContext('2d')!;
    c.clearRect(0, 0, 512, 512);
    if (this.chair) {
      // a plain side-view chair in gold line: seat at the hips, back behind, two legs to the floor
      c.save(); c.strokeStyle = '#C9922E'; c.lineWidth = 9; c.lineCap = 'round';
      const seatY = 482 - 440 * 0.205 + 20, bx = 256 - 52, fx = 256 + 78;
      c.beginPath();
      c.moveTo(bx, seatY); c.lineTo(fx, seatY);           // seat
      c.moveTo(bx, seatY); c.lineTo(bx - 8, seatY - 200);  // back
      c.moveTo(bx + 6, seatY); c.lineTo(bx + 6, 482);      // legs
      c.moveTo(fx - 6, seatY); c.lineTo(fx - 6, 482);
      c.stroke(); c.restore();
    }
    drawFigure(c, 256, 482, 440, p, { col, style: this.style, lw: 9, fill: this.fill ?? undefined });
    this.tex.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ contact shadow
let shadowTex: THREE.Texture | null = null;
/** A soft round shadow lying on the floor (y = 0), radius r. */
export function contactShadow(r: number, opacity = 0.6) {
  if (!shadowTex) {
    shadowTex = Stage3D.canvasTex(128, 128, (c) => {
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.5, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    });
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.004; m.renderOrder = -1;
  return m;
}

// ------------------------------------------------------------------ desk calendar with curling pages
const PW = 1.6, PH = 1.15, ROWS = 28;

function pageTex(label: string, sub: string, day: boolean) {
  return Stage3D.canvasTex(800, 576, (c) => {
    c.fillStyle = '#F4F1EA'; c.fillRect(0, 0, 800, 576);
    c.fillStyle = day ? '#B8740C' : '#FF3D6E'; c.fillRect(0, 0, 800, 70);
    c.fillStyle = '#F4F1EA'; c.font = font(F.mono(500), 30); c.textBaseline = 'middle';
    c.fillText(sub, 36, 36);
    c.fillStyle = '#0B0C10';
    const fam = /[가-힣]/.test(label) ? F.seed(700) : F.archivo(100, 900);
    c.font = font(fam, Math.min(label.length > 3 ? 240 : 300, (700 * 100) / measure(label, fam, 100)));
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.fillText(label, 400, 440);
  });
}

export class DeskCalendar {
  group = new THREE.Group();
  private root = new THREE.Group(); // the hinge line: pages and rings hang from here, tilted like the front board
  private pages: { front: THREE.Mesh; back: THREE.Mesh; geo: THREE.PlaneGeometry; base: Float32Array; grp: THREE.Group; k: number }[] = [];
  private static FRONT = -0.26; // front board tilt (bottom toward the camera)
  private static BACK = 0.44;   // back board tilt
  constructor(private st: Stage3D, labels: { label: string; sub: string }[]) {
    // an A-frame desk calendar: two boards meeting at the top, a binding of gold rings along the apex,
    // the pages hanging over the front board and turning over the top onto the back one
    const apex = PH * Math.cos(DeskCalendar.FRONT) + 0.035;
    const board = (tilt: number, mat: THREE.Material, z = 0) => {
      const g = new THREE.BoxGeometry(PW + 0.1, PH + 0.04, 0.03);
      g.translate(0, -(PH + 0.04) / 2, z);
      const m = new THREE.Mesh(g, mat); m.position.set(0, apex, 0); m.rotation.x = tilt;
      const e = this.st.edges(g, 0.45); e.position.copy(m.position); e.rotation.copy(m.rotation);
      this.group.add(m, e);
    };
    board(DeskCalendar.FRONT, st.ink, -0.02);
    board(DeskCalendar.BACK, st.ink, 0.02);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(PW + 0.24, 0.04, 1.25), st.gold);
    plate.position.set(0, 0.02, 0.04);
    this.group.add(plate);
    this.root.position.set(0, apex, 0);
    this.root.rotation.x = DeskCalendar.FRONT;
    this.group.add(this.root);
    for (let i = 0; i < 11; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.011, 8, 28), st.gold);
      ring.position.set(-PW / 2 + 0.1 + (i * (PW - 0.2)) / 10, 0, 0);
      ring.rotation.y = Math.PI / 2;
      this.root.add(ring);
    }
    labels.forEach((l, i) => {
      const geo = new THREE.PlaneGeometry(PW, PH, 1, ROWS);
      geo.translate(0, -PH / 2, 0); // hinge at y = 0
      const front = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: pageTex(l.label, l.sub, st.day), roughness: 0.8, metalness: 0, side: THREE.FrontSide }));
      const backM = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xe9e4da, roughness: 0.85, side: THREE.BackSide }));
      const grp = new THREE.Group();
      grp.add(front, backM);
      grp.position.set(0, 0, 0.008 + (labels.length - i) * Math.min(0.0025, 0.06 / labels.length));
      this.root.add(grp);
      this.pages.push({ front, back: backM, geo, base: Float32Array.from(geo.attributes.position!.array as Float32Array), grp, k: 0 });
    });
  }
  /** flip: how many pages have gone over (fractional = the next one is turning). fly: turned pages tear
   * off and drift away like leaves instead of coming to rest on the back board. */
  pose(flip: number, fly = false, flyFlip = flip) {
    // a turned page rests on the back board: from hanging (angle 0) forward, over the top, down the back
    const END = Math.PI * 2 - (DeskCalendar.BACK - DeskCalendar.FRONT) - 0.06;
    this.pages.forEach((p, i) => {
      const k = clamp(flip - i);
      // pages that are hanging untouched (or long turned and hidden) need no new shape
      if ((k === 0 && p.k === 0) || (k === 1 && p.k === 1 && !fly)) { p.grp.visible = k < 1 || i === this.pages.length - 1 || (!fly && flip - i < 3); return; }
      p.k = k;
      const pos = p.geo.attributes.position!;
      const a = pos.array as Float32Array;
      const th = END * ease.inOutCubic(k);
      const bend = Math.sin(Math.PI * k) * 0.9; // the page bows while it turns
      for (let v = 0; v < pos.count; v++) {
        const x = p.base[v * 3]!, y0 = p.base[v * 3 + 1]!;
        const n = Math.max(1, Math.round((-y0 / PH) * ROWS));
        let yy = 0, zz = 0;
        for (let s2 = 0; s2 < n; s2++) {
          const u = (s2 + 0.5) / ROWS;
          const ang = th - bend * u * u;
          yy -= Math.cos(ang) * (PH / ROWS);
          zz += Math.sin(ang) * (PH / ROWS);
        }
        a[v * 3] = x; a[v * 3 + 1] = yy; a[v * 3 + 2] = zz;
      }
      pos.needsUpdate = true;
      p.geo.computeVertexNormals();
      // keep only the last few turned pages (they lie on top of each other on the back board)
      p.grp.visible = k < 1 || i === this.pages.length - 1 || (!fly && flip - i < 3);
      if (fly) {
        // (flyFlip keeps counting after the pages stop turning, so the torn ones always finish flying away)
        const u = k > 0.5 ? Math.max(0, flyFlip - i - 0.55) : 0;
        p.grp.visible = k < 1 || (i === this.pages.length - 1 && u === 0) || u < 1.2;
        p.grp.position.set(-Math.abs(Math.sin(i * 2.1)) * u * 1.6, u * 0.8, 0.008 - u * 0.9);
        p.grp.rotation.set(u * 0.6, u * 1.1 * Math.cos(i * 1.7), u * 0.5);
      }
    });
  }
}

// ------------------------------------------------------------------ the camel (다 큰 낙타)
// (revision 9) A dromedary in polished gold: a long body with one shaped hump, a neck that dips and
// rises, a head with a muzzle and ears, and jointed legs (thigh, knee, cannon, pad). It walks with the
// camel's pace — both legs of a side together — its body rolling side to side; the feet are planted
// (the gait is driven by the distance walked, so nothing slides).
export class Camel {
  group = new THREE.Group();
  private body = new THREE.Group();
  private legs: { hip: THREE.Group; knee: THREE.Group; side: number; front: boolean }[] = [];
  private neck = new THREE.Group();
  private head = new THREE.Group();
  private ears: THREE.Group[] = [];
  private tail = new THREE.Group();
  static LEG = 0.7; // thigh and shin length (each), in local units
  constructor(st: Stage3D) {
    const mat = st.gold;
    const mesh = (geo: THREE.BufferGeometry, parent: THREE.Object3D, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rz = 0, rx = 0) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, 0, rz); parent.add(m); return m;
    };
    const sph = new THREE.SphereGeometry(1, 40, 24);
    this.body.position.y = 1.63; this.group.add(this.body);
    // torso and hump as one smooth surface: an ellipsoid, deeper at the chest and slimmer at the rump,
    // with the hump raised out of its back
    const tg = new THREE.SphereGeometry(1, 72, 40);
    const tp0 = tg.attributes.position!;
    for (let i = 0; i < tp0.count; i++) {
      const ux = tp0.getX(i), uy = tp0.getY(i), uz = tp0.getZ(i);
      const fx = 0.5 + 0.5 * ux; // 0 rump → 1 chest
      const girth = lerp(0.84, 1.08, fx);
      let x = ux * 0.84, y = uy * 0.32 * girth, z = uz * 0.29 * girth;
      const top = Math.max(0, uy);
      y += 0.33 * Math.exp(-((Math.abs(x + 0.06) / 0.4) ** 2.6)) * Math.pow(top, 0.9);
      y -= 0.04 * Math.max(0, -uy) * fx; // the belly drops a little at the front
      tp0.setXYZ(i, x, y, z);
    }
    tg.computeVertexNormals();
    mesh(tg, this.body, 0.05, 0, 0, 1, 1, 1);
    // neck: from the chest it dips forward and down, then rises to the head (a tube along a curve)
    this.neck.position.set(0.66, 0.08, 0); this.body.add(this.neck);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.24, -0.08, 0), new THREE.Vector3(0.46, 0.06, 0),
      new THREE.Vector3(0.56, 0.42, 0), new THREE.Vector3(0.58, 0.72, 0),
    ]);
    const tube = new THREE.TubeGeometry(curve, 40, 1, 16, false);
    // taper the tube: thick at the chest, slim at the throat
    const tp = tube.attributes.position!, tn = tube.attributes.normal!;
    for (let i = 0; i < tp.count; i++) {
      const u = Math.floor(i / 17) / 40;
      const c = curve.getPointAt(Math.min(1, u));
      const r = lerp(0.17, 0.075, Math.pow(u, 0.7));
      tp.setXYZ(i, c.x + tn.getX(i) * r, c.y + tn.getY(i) * r, c.z + tn.getZ(i) * r);
    }
    tube.computeVertexNormals();
    this.neck.add(new THREE.Mesh(tube, mat));
    mesh(sph, this.neck, 0.0, 0.0, 0, 0.17, 0.17, 0.17);
    // head: skull, long muzzle, ears
    this.head.position.set(0.58, 0.74, 0); this.neck.add(this.head);
    mesh(sph, this.head, 0.03, 0.02, 0, 0.13, 0.11, 0.1);
    mesh(new THREE.CapsuleGeometry(0.075, 0.2, 8, 16), this.head, 0.2, -0.03, 0, 1, 1, 0.9, -Math.PI / 2 + 0.18);
    mesh(sph, this.head, 0.33, -0.05, 0, 0.07, 0.065, 0.075);
    // eyes: two small dark beads, so the turn to us reads as a look
    const eyeM = new THREE.MeshStandardMaterial({ color: 0x0b0c10, roughness: 0.2, metalness: 0.1 });
    for (const z of [-0.085, 0.085]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), eyeM); e.position.set(0.09, 0.045, z); this.head.add(e); }
    for (const z of [-0.06, 0.06]) {
      const ear = new THREE.Group(); ear.position.set(-0.04, 0.1, z); this.head.add(ear);
      mesh(new THREE.ConeGeometry(0.03, 0.08, 10), ear, 0, 0.035, 0, 1, 1, 0.6, 0.35, z > 0 ? 0.3 : -0.3);
      this.ears.push(ear);
    }
    // legs: hip/shoulder → thigh → knee → shin → pad
    const L = Camel.LEG;
    for (const [x, z, front] of [[0.5, 0.17, true], [0.5, -0.17, true], [-0.5, 0.15, false], [-0.5, -0.15, false]] as const) {
      const hip = new THREE.Group(); hip.position.set(x, -0.05, z); this.body.add(hip);
      mesh(new THREE.CylinderGeometry(front ? 0.08 : 0.11, 0.05, L, 14).translate(0, -L / 2, 0), hip, 0, 0, 0);
      mesh(sph, hip, 0, 0, 0, front ? 0.085 : 0.115, front ? 0.085 : 0.115, front ? 0.085 : 0.115);
      const knee = new THREE.Group(); knee.position.y = -L; hip.add(knee);
      mesh(sph, knee, 0, 0, 0, 0.058, 0.058, 0.058);
      mesh(new THREE.CylinderGeometry(0.042, 0.036, L, 12).translate(0, -L / 2, 0), knee, 0, 0, 0);
      mesh(sph, knee, 0.02, -L - 0.01, 0, 0.085, 0.035, 0.075);
      this.legs.push({ hip, knee, side: z > 0 ? 1 : -1, front });
    }
    // tail: hangs from the rump, swings a little
    this.tail.position.set(-0.8, 0.02, 0); this.body.add(this.tail);
    mesh(new THREE.CapsuleGeometry(0.022, 0.36, 4, 8).translate(0, -0.2, 0), this.tail, 0, 0, 0, 1, 1, 1, -0.25);
    this.group.add(contactShadow(1.05, 0.55));
    this.group.scale.setScalar(0.72);
  }
  /**
   * dist: metres walked so far (drives the gait); speed: 0..1 (gait amplitude); look 0..1 turns the
   * head toward the camera; nod: a small nod (0..1 envelope); t: time (ears, tail).
   */
  pose(t: number, dist: number, speed: number, look: number, nod = 0) {
    const stride = 1.15; // local units walked per full gait cycle
    const ph = (dist / stride) * Math.PI * 2;
    const amp = clamp(speed);
    for (const l of this.legs) {
      // pace: both legs of a side move together; the two sides half a cycle apart
      const p = ph + (l.side > 0 ? 0 : Math.PI);
      const sw = Math.sin(p); // + = leg swinging forward
      const lift = Math.max(0, Math.cos(p)); // the leg is in the air while it swings forward
      l.hip.rotation.z = amp * 0.36 * sw * (l.front ? 1 : 0.9);
      // the knee folds back while the foot is lifted (camel: front knee forward, hind hock back)
      l.knee.rotation.z = -amp * (l.front ? 0.95 : 0.75) * lift * lift;
    }
    // the rolling pace: the body sways toward the side that is planted, bobs twice per cycle
    this.body.rotation.x = amp * 0.05 * Math.sin(ph);
    this.body.position.y = 1.63 + amp * 0.025 * Math.cos(ph * 2) - 0.012 * amp;
    // the neck balances the step; on `look` it turns toward us and the head follows further
    this.neck.rotation.z = amp * 0.07 * Math.sin(ph * 2 + 0.6) - 0.08 * nod;
    this.neck.rotation.y = 0.55 * look;
    this.head.rotation.y = 0.9 * look;
    this.head.rotation.z = 0.05 * Math.sin(ph * 2 + 1.2) * amp - 0.22 * nod + 0.06 * look;
    this.ears.forEach((e, i) => { e.rotation.x = (i ? 1 : -1) * (0.15 + 0.12 * look); });
    this.tail.rotation.z = 0.12 * Math.sin(t * 3.1) + amp * 0.1 * Math.sin(ph);
    this.group.rotation.y = Math.PI; // it walks toward screen-left
  }
}

// ------------------------------------------------------------------ chair
export function chairGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const box = (w: number, h: number, d: number, x: number, y: number, z: number) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); parts.push(g); };
  box(0.5, 0.05, 0.5, 0, 0.45, 0); // seat
  box(0.5, 0.5, 0.05, 0, 0.72, -0.225); // back
  for (const [x, z] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]] as const) box(0.04, 0.45, 0.04, x, 0.225, z);
  return mergeGeometries(parts)!;
}

// ------------------------------------------------------------------ rounded card (notification / task)
export function cardGeometry(w: number, h: number, r: number, depth: number) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -depth / 2);
  // planar UVs on the face
  const pos = g.attributes.position!, uv = g.attributes.uv!;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  return g;
}

/** Face of a notification card: an icon dot, a title bar and two text lines (no words, no brands). */
export function cardFace(seed: number, accent: string) {
  return Stage3D.canvasTex(512, 160, (c) => {
    c.fillStyle = '#16181F'; c.fillRect(0, 0, 512, 160);
    c.fillStyle = accent; c.beginPath(); c.arc(56, 80, 26, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(241,238,230,0.92)'; c.fillRect(104, 50, 150 + 120 * hash(seed, 1), 16);
    c.fillStyle = 'rgba(241,238,230,0.4)'; c.fillRect(104, 86, 220 + 120 * hash(seed, 2), 11); c.fillRect(104, 110, 120 + 140 * hash(seed, 3), 11);
    c.fillStyle = 'rgba(241,238,230,0.35)'; c.fillRect(440, 50, 40, 10);
  });
}

// ------------------------------------------------------------------ the mask, pre-fractured
export class Mask {
  group = new THREE.Group();
  shards: { mesh: THREE.Mesh; c: THREE.Vector3; dir: THREE.Vector3; spin: THREE.Vector3 }[] = [];
  constructor(st: Stage3D, seed: number, cells = 16) {
    // a shallow shell: the front of an ellipsoid, with a smile groove and two eye slits cut as dark inlays
    const g = new THREE.SphereGeometry(1, 40, 30, Math.PI * 0.18, Math.PI * 0.64, Math.PI * 0.12, Math.PI * 0.76).toNonIndexed();
    g.scale(0.62, 0.82, 0.45);
    const pos = g.attributes.position!;
    const tri = pos.count / 3;
    const seeds: THREE.Vector3[] = [];
    for (let i = 0; i < cells; i++) seeds.push(new THREE.Vector3((hash(seed, i, 1) - 0.5) * 1.2, (hash(seed, i, 2) - 0.5) * 1.6, 0.3));
    const groups: number[][] = seeds.map(() => []);
    const v = new THREE.Vector3();
    for (let t = 0; t < tri; t++) {
      v.set(0, 0, 0);
      for (let k = 0; k < 3; k++) v.x += pos.getX(t * 3 + k) / 3, v.y += pos.getY(t * 3 + k) / 3, v.z += pos.getZ(t * 3 + k) / 3;
      let best = 0, bd = 1e9;
      seeds.forEach((s, i) => { const d = (s.x - v.x) ** 2 + (s.y - v.y) ** 2; if (d < bd) { bd = d; best = i; } });
      groups[best]!.push(t);
    }
    groups.forEach((tris, i) => {
      if (!tris.length) return;
      const arr = new Float32Array(tris.length * 9);
      const c = new THREE.Vector3();
      tris.forEach((t, j) => { for (let k = 0; k < 3; k++) { arr[j * 9 + k * 3] = pos.getX(t * 3 + k); arr[j * 9 + k * 3 + 1] = pos.getY(t * 3 + k); arr[j * 9 + k * 3 + 2] = pos.getZ(t * 3 + k); c.x += pos.getX(t * 3 + k); c.y += pos.getY(t * 3 + k); c.z += pos.getZ(t * 3 + k); } });
      c.divideScalar(tris.length * 3);
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      sg.translate(-c.x, -c.y, -c.z);
      sg.computeVertexNormals();
      const mesh = new THREE.Mesh(sg, st.goldRough);
      mesh.position.copy(c);
      this.group.add(mesh);
      this.shards.push({ mesh, c, dir: new THREE.Vector3(c.x * 2.2, c.y * 1.6 + 0.6, 1.4 + hash(seed, i, 5)), spin: new THREE.Vector3(hash(seed, i, 6) * 8 - 4, hash(seed, i, 7) * 8 - 4, hash(seed, i, 8) * 6 - 3) });
    });
    // features: eye slits and the smile, as thin dark bars that ride with the nearest shard
    const dark = new THREE.MeshStandardMaterial({ color: 0x050608, roughness: 0.6 });
    const feat = (geo: THREE.BufferGeometry, x: number, y: number, rz = 0) => {
      const m = new THREE.Mesh(geo, dark); m.position.set(x, y, 0.43); m.rotation.z = rz; this.group.add(m); return m;
    };
    feat(new THREE.CapsuleGeometry(0.035, 0.12, 4, 8), -0.21, 0.16, Math.PI / 2);
    feat(new THREE.CapsuleGeometry(0.035, 0.12, 4, 8), 0.21, 0.16, Math.PI / 2);
    const smile = new THREE.TorusGeometry(0.24, 0.022, 6, 24, Math.PI * 0.8);
    feat(smile, 0, -0.08, Math.PI * 1.1);
  }
  /** k: seconds since the crack (negative = intact). */
  pose(k: number) {
    const s = Math.max(0, k);
    this.shards.forEach((sh) => {
      const q = 0.55 * s; // a slow, heavy burst
      sh.mesh.position.set(sh.c.x + sh.dir.x * q, sh.c.y + sh.dir.y * q - 3.2 * s * s, sh.c.z + sh.dir.z * q);
      sh.mesh.rotation.set(sh.spin.x * q, sh.spin.y * q, sh.spin.z * q);
    });
    // the features fall away with the face
    this.group.children.forEach((ch) => { if (!this.shards.some((sh) => sh.mesh === ch)) ch.visible = k < 0; });
  }
}

// ------------------------------------------------------------------ office building, floor by floor
const BF = { w: 1.6, h: 0.36, d: 1.0, pitch: 0.41 };
const DUST_N = 1600, DEBRIS_N = 56;
export class Building {
  group = new THREE.Group();
  floors: { mesh: THREE.Group; seed: number; win: THREE.MeshStandardMaterial; body: THREE.Mesh }[] = [];
  dust: THREE.Points;
  private debris: THREE.InstancedMesh; private debrisGold: THREE.InstancedMesh;
  private ring: THREE.Mesh;
  private m = new THREE.Matrix4(); private q = new THREE.Quaternion(); private e = new THREE.Euler(); private v = new THREE.Vector3(); private s3 = new THREE.Vector3();
  constructor(private st: Stage3D, n = 9) {
    const { w: fw, h: fh, d: fd } = BF;
    const winTex = Stage3D.canvasTex(512, 128, (c) => {
      c.fillStyle = '#0E1015'; c.fillRect(0, 0, 512, 128);
      for (let i = 0; i < 10; i++) { c.fillStyle = `rgba(255,${190 + (i % 3) * 20},120,${0.55 + 0.4 * ((i * 7) % 5) / 5})`; c.fillRect(14 + i * 50, 30, 34, 66); }
    });
    const slab = new THREE.BoxGeometry(fw + 0.08, 0.05, fd + 0.08);
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group();
      // each floor has its own window material, so the lights can die floor by floor
      const win = new THREE.MeshStandardMaterial({ map: winTex, emissive: new THREE.Color(1, 0.62, 0.3), emissiveMap: winTex, emissiveIntensity: st.day ? 0.6 : 1.4, roughness: 0.4, metalness: 0.2 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, fd), [win, win, st.ink, st.ink, win, win]);
      const top = new THREE.Mesh(slab, st.gold); top.position.y = fh / 2;
      g.add(body, top, st.edges(body.geometry, 0.55));
      g.position.y = fh / 2 + i * BF.pitch;
      this.group.add(g);
      this.floors.push({ mesh: g, seed: i, win, body });
    }
    // dust: soft round puffs
    const arr = new Float32Array(DUST_N * 3);
    const dustTex = Stage3D.canvasTex(64, 64, (c) => {
      const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
    });
    this.dust = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(arr, 3)),
      new THREE.PointsMaterial({ map: dustTex, color: st.day ? 0x9c8a6c : 0xffd7a0, size: 0.85, sizeAttenuation: true, transparent: true, opacity: 0.7, depthWrite: false }));
    this.dust.frustumCulled = false;
    this.group.add(this.dust);
    // debris: chunks of facade (ink) and of the gold slabs
    const chunk = new THREE.BoxGeometry(1, 1, 1);
    this.debris = new THREE.InstancedMesh(chunk, st.ink, DEBRIS_N);
    this.debrisGold = new THREE.InstancedMesh(chunk, st.gold, DEBRIS_N);
    for (const x of [this.debris, this.debrisGold]) { x.count = 0; x.frustumCulled = false; this.group.add(x); }
    // the shock ring of dust rolling out along the floor
    const ringTex = Stage3D.canvasTex(256, 256, (c) => {
      const gr = c.createRadialGradient(128, 128, 40, 128, 128, 128);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.62, 'rgba(255,255,255,0.15)'); gr.addColorStop(0.85, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr; c.fillRect(0, 0, 256, 256);
    });
    this.ring = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: ringTex, color: st.day ? 0xa8977a : 0xffd7a0, transparent: true, opacity: 0, depthWrite: false }));
    this.ring.position.y = 0.01; this.ring.visible = false;
    this.group.add(this.ring);
  }
  /** Window lights per floor (0 = dark, 1 = lit). */
  lights(fn: (i: number) => number) {
    this.floors.forEach((f, i) => { const k = clamp(fn(i)); f.win.emissiveIntensity = (this.st.day ? 0.6 : 1.4) * k + 0.03; f.win.color.setScalar(0.22 + 0.78 * k); });
  }

  /**
   * The collapse (revision 9), in seconds since 아 (c: the crack), 폐 (a) and 업 (b); negative = not yet.
   * c: the top floors shear off with a jolt and a puff. a: the upper block topples over its right edge,
   * shedding chunks. b: the lower floors pancake straight down, the block falls onto the heap, and a ring
   * of dust rolls out along the floor.
   */
  collapse(c: number, a: number, b: number) {
    const n = this.floors.length, half = Math.ceil(n / 2), P = BF.pitch;
    const yS = half * P; // the shear plane
    // lower floors: pancake from the top down, each squashed as it lands
    let heap = yS;
    for (let i = 0; i < half; i++) {
      const f = this.floors[i]!, y0 = BF.h / 2 + i * P;
      const s = b - (half - 1 - i) * 0.018;
      const yF = 0.06 + i * 0.12;
      const y = s > 0 ? Math.max(yF, y0 - 0.5 * 44 * s * s) : y0;
      const k = clamp((y0 - y) / Math.max(1e-3, y0 - yF));
      const side = hash(i, 3) < 0.5 ? -1 : 1;
      f.mesh.position.set(side * 0.12 * k * hash(i, 7), y, (hash(i, 4) - 0.5) * 0.16 * k);
      f.mesh.rotation.set((hash(i, 5) - 0.5) * 0.18 * k, side * 0.22 * k, (hash(i, 6) - 0.5) * 0.12 * k);
      f.mesh.scale.set(1 + 0.08 * k, 1 - 0.68 * k, 1 + 0.08 * k);
      if (i === half - 1) heap = y + BF.h * (1 - 0.68 * k) / 2 + 0.03;
    }
    // the upper block: one rigid piece hinged at the right end of the shear plane
    const crackK = c > 0 ? ease.outBack(clamp(c / 0.09), 2.5) : 0;
    let th = -0.035 * crackK, drop = 0.045 * crackK, slide = 0;
    if (a > 0) { th -= 0.5 * 7.5 * a * a; slide = 0.22 * a; }
    // on 업 the hinge gives way: the block keeps turning, faster, as it falls onto the heap, where it
    // breaks up into its floors
    if (b > 0) th -= 2.2 * b + 0.5 * 14 * b * b;
    th = Math.max(th, -1.12);
    const fallY = yS - drop - 0.5 * 34 * Math.max(0, b) ** 2;
    const pivY = b > 0 ? Math.max(heap, fallY) : yS - drop;
    const tLand = b > 0 ? Math.sqrt(Math.max(0, 2 * (yS - drop - heap) / 34)) : Infinity;
    const brk = b > tLand ? ease.outCubic(clamp((b - tLand) / 0.2)) : 0;
    const pivX = BF.w / 2 + slide;
    const ct = Math.cos(th), sn = Math.sin(th);
    for (let i = half; i < n; i++) {
      const f = this.floors[i]!, j = i - half;
      const ox = -BF.w / 2, oy = BF.h / 2 + j * P; // offset from the pivot, unrotated
      const spread = brk * (0.18 + 0.12 * j);
      f.mesh.position.set(pivX + ox * ct - oy * sn + spread * (1 + hash(i, 21)), Math.max(0.2, pivY + ox * sn + oy * ct - brk * 0.25 * j), (hash(i, 22) - 0.5) * 0.7 * brk);
      f.mesh.rotation.set((hash(i, 23) - 0.5) * 0.5 * brk, (hash(i, 24) - 0.5) * 0.7 * brk, th - brk * (0.15 + 0.2 * hash(i, 25)));
      f.mesh.scale.set(1, 1, 1);
    }
    // debris
    let nd = 0, ng = 0;
    for (let i = 0; i < DEBRIS_N; i++) {
      const second = i >= DEBRIS_N * 0.45;
      const s = second ? b - 0.05 : a;
      if (s <= 0) continue;
      const h1 = hash(i, 11), h2 = hash(i, 12), h3 = hash(i, 13);
      const ang = second ? h1 * Math.PI * 2 : -0.6 + h1 * 1.6; // the first burst sprays right and back
      const sp = second ? 1.4 + 2.6 * h2 : 1.0 + 2.2 * h2;
      const vx = Math.cos(ang) * sp, vz = Math.sin(ang) * sp * (second ? 0.8 : 0.5);
      const y0 = second ? 0.2 + 0.4 * h3 : yS + 0.1 * h3, vy = second ? 1.2 + 1.8 * h3 : 0.6 + 1.6 * h3;
      const sz = 0.05 + 0.13 * hash(i, 14);
      const y = ballisticY(y0, vy, 9.8 * 1.6, s, sz * 0.4);
      const drag = (1 - Math.exp(-s * 2.2)) / 2.2;
      this.e.set(hash(i, 15) * 9 * s, hash(i, 16) * 7 * s, hash(i, 17) * 8 * s); this.q.setFromEuler(this.e);
      this.m.compose(this.v.set((second ? 0 : BF.w / 2) + vx * drag, y, vz * drag), this.q, this.s3.set(sz * 1.6, sz * 0.7, sz));
      if (hash(i, 18) < 0.3) this.debrisGold.setMatrixAt(ng++, this.m); else this.debris.setMatrixAt(nd++, this.m);
    }
    this.debris.count = nd; this.debrisGold.count = ng;
    this.debris.instanceMatrix.needsUpdate = true; this.debrisGold.instanceMatrix.needsUpdate = true;
    // dust: a puff on the crack, a plume off the shear on 폐, the ground ring when the heap lands on 업
    const pos = this.dust.geometry.attributes.position!;
    for (let i = 0; i < DUST_N; i++) {
      const kind = i % 4; // 0: shear plume, 1-3: ground ring
      const s = kind === 0 ? (i % 8 === 0 ? c : a) : b - 0.06;
      if (s <= 0) { pos.setXYZ(i, 0, -50, 0); continue; }
      const h1 = hash(i, 1), h2 = hash(i, 2), h3 = hash(i, 3);
      if (kind === 0) {
        const ang = h1 * Math.PI * 2, r = 0.6 + 1.6 * h2 * (1 - Math.exp(-s * 3));
        pos.setXYZ(i, Math.cos(ang) * r * 0.9 + 0.3, yS + (h3 - 0.3) * 0.5 + 0.5 * s - 0.6 * s * s, Math.sin(ang) * r * 0.6);
      } else {
        const ang = h1 * Math.PI * 2, r = 0.7 + (1.8 + 3.4 * h2) * (1 - Math.exp(-s * 3.2));
        pos.setXYZ(i, Math.cos(ang) * r, 0.06 + (0.15 + 1.1 * h3 * h3) * (1 - Math.exp(-s * 4)), Math.sin(ang) * r * 0.85);
      }
    }
    pos.needsUpdate = true;
    const dm = this.dust.material as THREE.PointsMaterial;
    dm.opacity = 0.55;
    const sr = b - 0.06;
    this.ring.visible = sr > 0;
    if (sr > 0) {
      const R = 0.8 + 4.6 * (1 - Math.exp(-sr * 3.4));
      this.ring.scale.set(R, 1, R * 0.9);
      (this.ring.material as THREE.MeshBasicMaterial).opacity = 1.0 * (1 - clamp(sr / 1.6));
    }
  }

  /** a: seconds since the first drop (폐), b: seconds since the second (업); negative = not yet. */
  /** day: instead of falling, the floors sink one by one into the gold floor (as into liquid) */
  sink(a: number, b: number) {
    const n = this.floors.length;
    this.floors.forEach((f, i) => {
      const s = (i >= n / 2 ? a : b) - (n - 1 - i) * 0.035;
      const y0 = 0.18 + i * 0.41;
      f.mesh.position.set(0, y0 - (s > 0 ? Math.min(y0 + 0.5, 4.2 * s * s + 1.2 * s) : 0), 0);
      f.mesh.rotation.set(0, s > 0 ? s * 0.3 : 0, 0);
    });
  }
}

/** Height after time s of a body launched at y0 with vy under gravity g, bouncing (damped) on the floor at `floor`. */
function ballisticY(y0: number, vy: number, g: number, s: number, floor: number) {
  let p = y0, vel = vy, left = s;
  for (let k = 0; k < 5 && left > 0; k++) {
    const disc = vel * vel + 2 * g * (p - floor);
    const th = (vel + Math.sqrt(Math.max(0, disc))) / g;
    if (th >= left) return p + vel * left - 0.5 * g * left * left;
    left -= th; p = floor; vel = (g * th - vel) * 0.3;
    if (vel < 0.15) return floor;
  }
  return p;
}

/** Eased value of a step at time t0 (0 before, 1 after `dur`). */
export const stepK = (t: number, t0: number, dur = 0.3, fn = ease.outExpo) => fn(clamp((t - t0) / dur));
export { lerp };

// ------------------------------------------------------------------ agents (revision 9)
/** Height of an agent at scale 1 (m). */
export const AGENT_H = 0.48;
// the body is a soft superellipse of revolution, cut flat at the floor
const AB = { c: 0.22, h: 0.26, R: 0.16, n: 2.5 };
const agentR = (y: number) => { const s = Math.min(1, Math.abs(y - AB.c) / AB.h); return AB.R * Math.pow(1 - Math.pow(s, AB.n), 1 / AB.n); };
function agentProfile(y0: number, y1: number, steps: number, grow = 1) {
  const pts: THREE.Vector2[] = [];
  const th = (y: number) => { const u = (y - AB.c) / AB.h; return Math.sign(u) * Math.asin(Math.min(1, Math.pow(Math.abs(u), AB.n / 2))); };
  const a0 = th(y0), a1 = th(y1);
  for (let i = 0; i <= steps; i++) {
    const a = lerp(a0, a1, i / steps);
    const y = AB.c + AB.h * Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 2 / AB.n);
    pts.push(new THREE.Vector2(Math.max(1e-4, AB.R * Math.pow(Math.abs(Math.cos(a)), 2 / AB.n)) * grow, y));
  }
  return pts;
}

/**
 * The agents: small designed helpers — a white ceramic body (a soft pebble of revolution), a black glass
 * visor with two warm pill eyes, a polished gold ring at the foot, a soft contact shadow. Instanced;
 * placed per frame with set(). An agent that is off turns graphite and its eyes go out.
 */
export class Agents {
  group = new THREE.Group();
  private body: THREE.InstancedMesh; private visor: THREE.InstancedMesh; private eyes: THREE.InstancedMesh;
  private ring: THREE.InstancedMesh; private shadow: THREE.InstancedMesh;
  private n = 0;
  private m = new THREE.Matrix4(); private m2 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private e = new THREE.Euler();
  private v = new THREE.Vector3(); private s = new THREE.Vector3(); private col = new THREE.Color();
  private onCol: THREE.Color; private offCol = new THREE.Color(0.055, 0.056, 0.062);
  private eyeCol: THREE.Color;
  private static EY = 0.312;
  constructor(st: Stage3D, public max: number) {
    const day = st.day;
    // body: flat foot, widest at the hips, a round crown
    const pts = [new THREE.Vector2(0, 0), ...agentProfile(0, AB.c + AB.h, 28)];
    const body = new THREE.LatheGeometry(pts, 40);
    // visor: a band of black glass across the face
    const visor = new THREE.LatheGeometry(agentProfile(0.255, 0.372, 10, 1.012), 24, -0.95, 1.9);
    const eye = (sgn: number) => {
      const a = sgn * 0.3, r = agentR(Agents.EY) * 1.012 + 0.002;
      return new THREE.CapsuleGeometry(0.0115, 0.02, 4, 10).scale(1, 1, 0.45).rotateY(a).translate(Math.sin(a) * r, Agents.EY, Math.cos(a) * r);
    };
    const eyes = mergeGeometries([eye(-1), eye(1)])!;
    const ring = new THREE.TorusGeometry(agentR(0.028) + 0.003, 0.0105, 8, 40).rotateX(Math.PI / 2).translate(0, 0.028, 0);
    const ceramic = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.38, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: day ? 0.85 : 0.55 });
    const glass = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.006, 0.006, 0.008), roughness: 0.12, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.4 });
    const glow = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    this.onCol = day ? new THREE.Color(0.86, 0.85, 0.82) : new THREE.Color(0.78, 0.79, 0.78);
    this.eyeCol = day ? new THREE.Color(1.0, 0.95, 0.86) : new THREE.Color(2.6, 2.05, 1.35);
    const sh = new THREE.CircleGeometry(0.21, 28).rotateX(-Math.PI / 2).translate(0, 0.003, 0);
    const shm = new THREE.MeshBasicMaterial({ map: blobTex(), color: 0x000000, transparent: true, opacity: day ? 0.32 : 0.6, depthWrite: false });
    this.body = new THREE.InstancedMesh(body, ceramic, max);
    this.visor = new THREE.InstancedMesh(visor, glass, max);
    this.eyes = new THREE.InstancedMesh(eyes, glow, max);
    this.ring = new THREE.InstancedMesh(ring, st.gold, max);
    this.shadow = new THREE.InstancedMesh(sh, shm, max);
    this.shadow.renderOrder = -1;
    for (const x of [this.body, this.eyes]) { x.setColorAt(0, this.onCol); x.instanceColor!.setUsage(THREE.DynamicDrawUsage); }
    for (const x of this.all()) { x.count = 0; x.frustumCulled = false; x.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.group.add(x); }
  }
  private all() { return [this.body, this.visor, this.eyes, this.ring, this.shadow]; }
  begin() { this.n = 0; }
  /**
   * One agent standing at (x, y, z) (y = the surface it stands on), scale g, facing yaw (0 = +z).
   * hop 0..1: one squash-and-stretch hop. light 0..1: on (1) or off (0). blink 0..1 closes the eyes.
   * glow: extra eye brightness (a flash). lean: forward tilt (rad).
   */
  set(x: number, y: number, z: number, g: number, yaw: number, hop: number, light = 1, blink = 0, glow = 0, lean = 0) {
    if (this.n >= this.max || g <= 0.001) return;
    const i = this.n++;
    const up = Math.sin(Math.PI * clamp(hop));
    const lift = y + 0.07 * up * g;
    const sq = 1 + 0.07 * up;
    this.e.set(lean, yaw, 0, 'YXZ'); this.q.setFromEuler(this.e);
    this.m.compose(this.v.set(x, lift, z), this.q, this.s.set(g / Math.sqrt(sq), g * sq, g / Math.sqrt(sq)));
    this.body.setMatrixAt(i, this.m); this.visor.setMatrixAt(i, this.m); this.ring.setMatrixAt(i, this.m);
    this.body.setColorAt(i, this.col.copy(this.offCol).lerp(this.onCol, clamp(light)));
    // eyes: close about the eye line
    const closed = Math.max(0.12, 1 - clamp(blink));
    this.m2.makeTranslation(0, Agents.EY, 0).multiply(new THREE.Matrix4().makeScale(1, closed, 1)).multiply(new THREE.Matrix4().makeTranslation(0, -Agents.EY, 0));
    this.eyes.setMatrixAt(i, this.m.clone().multiply(this.m2));
    const k = clamp(light) * (1 + glow);
    this.eyes.setColorAt(i, this.col.setRGB(0.02 + this.eyeCol.r * k, 0.02 + this.eyeCol.g * k, 0.025 + this.eyeCol.b * k));
    this.m.compose(this.v.set(x, y, z), this.q, this.s.set(g * (1 - 0.25 * up), 1, g * (1 - 0.25 * up)));
    this.shadow.setMatrixAt(i, this.m);
  }
  end() {
    for (const x of this.all()) { x.count = this.n; x.instanceMatrix.needsUpdate = true; }
    this.body.instanceColor!.needsUpdate = true; this.eyes.instanceColor!.needsUpdate = true;
  }
}

let blobT: THREE.Texture | null = null;
/** A soft round falloff (white, used as an alpha-ish map for blob shadows). */
function blobTex() {
  if (!blobT) blobT = Stage3D.canvasTex(64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  });
  return blobT;
}
