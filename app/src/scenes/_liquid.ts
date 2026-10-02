// Liquid light: a ray-marched 3D liquid (metaballs + optional extruded letters) with a mirror-glass
// surface that reflects and refracts the dawn sky. The video's signature visual (revision 3).
// Pure function of the parameters passed to render(); the caller derives them from song time.
import * as THREE from 'three';
import { FSPass, SS_TAP, SS_TAP_GLSL } from '../engine/gl';
import type { SceneCtx } from '../engine/scene';
import { F, font, measure } from '../engine/type';

const MAXB = 10;

const FRAG = /* glsl */ `
${SS_TAP_GLSL}
uniform float opacity, reveal;
uniform float t, level, seed, amp, spread, speed, letters, melt, depth, alphaBg, exposure, ground, groundY, fov;
uniform int nb;
uniform vec3 camPos, camTgt, center, letterPos;
uniform vec2 letterSize;    // world size of the letters' box (x, y)
uniform vec4 blobs[${MAXB}]; // xyz offset (unit), w radius
uniform sampler2D sdfTex;   // signed distance of the letters, in units of letterSize.y
uniform vec2 aspect;

// ---- what the liquid reflects: a dark studio lit by bands of dawn (high contrast reads as chrome)
vec3 sky(vec3 d) {
  float h = d.y;
  vec3 c = C_INK * 0.25 + C_INDIGO * 0.18 * smoothstep(-0.2, 0.6, h);
  // horizon band: the dawn itself
  c += dawn(clamp(0.45 + 0.5 * level, 0.0, 1.0)) * exp(-pow((h - 0.02) / 0.07, 2.0)) * (1.2 + 2.0 * level);
  // a higher, thinner rose band
  c += C_ROSE * exp(-pow((h - 0.32) / 0.03, 2.0)) * 0.9;
  // two vertical softboxes (paper white) and a gold one behind
  float az = atan(d.x, -d.z);
  c += C_PAPER * smoothstep(0.06, 0.0, abs(az - 0.9)) * smoothstep(-0.1, 0.2, h) * 1.4;
  c += C_PAPER * smoothstep(0.04, 0.0, abs(az + 1.3)) * smoothstep(-0.1, 0.3, h) * 1.1;
  c += C_DAWN * smoothstep(0.25, 0.0, abs(abs(az) - 2.8)) * 0.8;
  // the sun, low and hot
  float sun = pow(max(dot(d, normalize(vec3(0.15, 0.06, -1.0))), 0.0), 220.0);
  c += C_GLOW * sun * (4.0 + 8.0 * level);
  // ground: black mirror-ish
  c = mix(c, C_INK * 0.15, smoothstep(0.0, -0.25, h));
  return c;
}

// what the camera sees behind the liquid (softer than what the liquid reflects)
vec3 skyBg(vec3 d) { return dawn(clamp(level * (0.55 + 0.6 * exp(-max(d.y + 0.05, 0.0) * 3.5)), 0.0, 1.0)) * mix(1.0, 0.35, smoothstep(0.0, -0.4, d.y)); }

float sdLetters(vec3 p) {
  vec3 q = p - letterPos;
  vec2 uv = q.xy / letterSize + 0.5;
  float d2;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    vec2 c = clamp(uv, 0.0, 1.0);
    d2 = length((uv - c) * letterSize) + 0.25 * letterSize.y;
  } else d2 = texture(sdfTex, vec2(uv.x, 1.0 - uv.y)).r * letterSize.y;
  d2 = max(d2, (uv.x - reveal) * letterSize.x); // letters not yet sung are cut away
  vec2 w = vec2(d2, abs(q.z) - depth);
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - 0.02;
}

float sdBlobs(vec3 p) {
  float d = 1e5;
  for (int i = 0; i < ${MAXB}; i++) {
    if (i >= nb) break;
    vec4 b = blobs[i];
    d = smin(d, length(p - (center + b.xyz)) - b.w, 0.55);
  }
  return d;
}

float map(vec3 p) {
  float d = sdBlobs(p);
  if (letters > 0.0) {
    float l = sdLetters(p);
    // melt: letters swell and fuse into the blobs
    l -= melt * 0.08;
    d = mix(d, smin(l, d, 0.25 + 0.6 * melt), letters);
  }
  // ripples
  d += amp * 0.018 * snoise(p * 1.6 + vec3(0.0, t * speed * 0.7, t * 0.3));
  if (ground > 0.0) d = smin(d, p.y - groundY, 0.35 * ground);
  return d;
}

vec3 normalAt(vec3 p) {
  vec2 e = vec2(0.004, 0.0);
  return normalize(vec3(map(p + e.xyy) - map(p - e.xyy), map(p + e.yxy) - map(p - e.yxy), map(p + e.yyx) - map(p - e.yyx)));
}

// thin-film iridescence (cheap)
vec3 film(float c) { return 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + c * 1.6)); }

vec4 shade(vec2 px) {
  vec2 uv = (px / vec2(${1920}.0, ${1080}.0)) * 2.0 - 1.0;
  uv.x *= aspect.x;
  vec3 ww = normalize(camTgt - camPos), uu = normalize(cross(ww, vec3(0, 1, 0))), vv = cross(uu, ww);
  vec3 rd = normalize(uv.x * uu + uv.y * vv + fov * ww);
  vec3 ro = camPos;
  float tt = 0.0, hit = -1.0;
  for (int i = 0; i < 160; i++) {
    vec3 p = ro + rd * tt;
    float d = map(p);
    if (d < 0.0006 * tt) { hit = tt; break; }
    tt += d * 0.7;
    if (tt > 60.0) break;
  }
  if (hit < 0.0) return vec4(skyBg(rd) * alphaBg, alphaBg);
  vec3 p = ro + rd * hit, n = normalAt(p);
  float fres = pow(1.0 - max(dot(-rd, n), 0.0), 4.0);
  vec3 refl = sky(reflect(rd, n));
  vec3 refr = sky(refract(rd, n, 0.72)) * vec3(1.0, 0.92, 0.85);
  vec3 irid = film(dot(n, -rd) + 0.15 * snoise(p * 1.7));
  vec3 col = mix(refr * 0.35, refl, 0.55 + 0.45 * fres);
  col *= mix(vec3(1.0), irid, 0.22);
  col += C_GLOW * pow(max(dot(reflect(rd, n), normalize(vec3(0.0, 0.12, -1.0))), 0.0), 64.0) * 3.0;
  return vec4(col * exposure, 1.0);
}

void main() {
  vec2 px = FRAG_PX;
  vec4 acc = vec4(0.0);
  for (int k = ssK0(); k < ssK1(); k++) acc += shade(px + rgss(k));
  acc *= ssWeight();
  fragColor = acc * opacity;
}`;

export interface LiquidParams {
  t: number;
  /** dawn level of the reflected sky 0..1 */ level?: number;
  cam?: { pos: [number, number, number]; target: [number, number, number]; fov?: number };
  /** blob field */ n?: number; center?: [number, number, number]; spread?: number; speed?: number; amp?: number; radius?: number; seed?: number;
  /** 0..1 how present the extruded letters are; melt 0..1 fuses them with the blobs */ letters?: number; melt?: number;
  letterPos?: [number, number, number]; letterHeight?: number; depth?: number;
  /** liquid floor: 0 = none, 1 = a pool at groundY */ ground?: number; groundY?: number;
  /** 1 = draw the sky where nothing is hit (full frame); 0 = transparent there (composite over) */ background?: number;
  exposure?: number;
  /** 0..1 fades the whole layer (premultiplied) */ opacity?: number;
  /** how many characters of the text are shown (default all) */ chars?: number;
}

export class Liquid {
  pass: FSPass;
  private sdf: THREE.DataTexture;
  private aspect = 1;
  /** right edge of each character in the SDF's uv.x */
  bounds: number[] = [];
  private lw = 1; private lh = 1;
  constructor(text = 'AGI', family = F.archivo(125, 900)) {
    const { tex, aspect, bounds } = makeSDF(text, family);
    this.sdf = tex; this.aspect = aspect; this.bounds = bounds;
    const blobs = Array.from({ length: MAXB }, () => new THREE.Vector4());
    this.pass = new FSPass(FRAG, {
      opacity: { value: 1 }, reveal: { value: 2 }, t: { value: 0 }, level: { value: 0.6 }, seed: { value: 0 }, amp: { value: 1 }, spread: { value: 1 }, speed: { value: 1 },
      letters: { value: 0 }, melt: { value: 0 }, depth: { value: 0.35 }, alphaBg: { value: 1 }, exposure: { value: 1 },
      ground: { value: 0 }, groundY: { value: -1.5 }, fov: { value: 1.6 }, nb: { value: 6 },
      camPos: { value: new THREE.Vector3(0, 0, 8) }, camTgt: { value: new THREE.Vector3() }, center: { value: new THREE.Vector3() },
      letterPos: { value: new THREE.Vector3() }, letterSize: { value: new THREE.Vector2(1, 1) },
      blobs: { value: blobs }, sdfTex: { value: this.sdf }, aspect: { value: new THREE.Vector2(16 / 9, 1) }, ssTap: SS_TAP,
    }, { blending: THREE.CustomBlending, transparent: true });
    const m = this.pass.mat;
    m.blendEquation = THREE.AddEquation;
    m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor;
    m.blendSrcAlpha = THREE.OneFactor; m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
  }

  render(ctx: SceneCtx, out: THREE.WebGLRenderTarget, p: LiquidParams) {
    const u = this.pass.u;
    const t = p.t, seed = p.seed ?? 1, n = Math.min(MAXB, p.n ?? 6), sp = p.spread ?? 1.2, speed = p.speed ?? 1, r0 = p.radius ?? 0.55;
    u.t!.value = t; u.level!.value = p.level ?? 0.6; u.amp!.value = p.amp ?? 1; u.speed!.value = speed;
    u.letters!.value = p.letters ?? 0; u.melt!.value = p.melt ?? 0; u.depth!.value = p.depth ?? 0.35;
    u.alphaBg!.value = p.background ?? 1; u.exposure!.value = p.exposure ?? 1; u.opacity!.value = p.opacity ?? 1;
    u.reveal!.value = p.chars === undefined ? 2 : p.chars <= 0 ? -1 : (this.bounds[Math.min(p.chars, this.bounds.length) - 1] ?? 2) + 0.004;
    u.ground!.value = p.ground ?? 0; u.groundY!.value = p.groundY ?? -1.5; u.nb!.value = n;
    const cam = p.cam ?? { pos: [0, 0, 8], target: [0, 0, 0] };
    (u.camPos!.value as THREE.Vector3).set(...cam.pos); (u.camTgt!.value as THREE.Vector3).set(...cam.target);
    u.fov!.value = cam.fov ?? 1.6;
    (u.center!.value as THREE.Vector3).set(...(p.center ?? [0, 0, 0]));
    const lh = p.letterHeight ?? 2;
    (u.letterSize!.value as THREE.Vector2).set(lh * this.aspect, lh);
    (u.letterPos!.value as THREE.Vector3).set(...(p.letterPos ?? [0, 0, 0]));
    // blobs orbit on slow Lissajous paths; deterministic in t
    const bl = u.blobs!.value as THREE.Vector4[];
    for (let i = 0; i < MAXB; i++) {
      const a = seed * 13.1 + i * 2.39996;
      const w = speed * (0.35 + 0.17 * ((i * 7) % 5));
      bl[i]!.set(
        sp * Math.sin(a + t * w) * 1.4,
        sp * Math.sin(a * 1.7 + t * w * 1.3) * 0.75,
        sp * Math.cos(a * 0.9 + t * w * 0.8) * 0.8,
        r0 * (0.65 + 0.55 * ((i * 37 + Math.round(seed * 11)) % 7) / 6),
      );
    }
    this.pass.render(ctx.renderer, out);
    void this.lw; void this.lh;
  }
}

/** Signed distance field of `text` (inside < 0), in units of the text height, as a float texture. */
function makeSDF(text: string, family: string) {
  const H = 512, size = 460;
  // letters are spaced by their ink, not their advance: every visible gap is the same (A G I, not A GI);
  // the I gets slab serifs so it reads as a letter, not a bar, and its serifs count as its ink
  const mc = document.createElement('canvas').getContext('2d')!;
  mc.font = font(family, size);
  const gapPx = text.length > 1 ? size * 0.26 : 0;
  const ink = Array.from(text).map((ch) => {
    const m = mc.measureText(ch);
    const l = -m.actualBoundingBoxLeft, r = m.actualBoundingBoxRight, cw = measure(ch, family, size);
    if (ch === 'I') { const cx = cw / 2, sw = (r - l) * 1.9; return { ch, cw, l: Math.min(l, cx - sw / 2), r: Math.max(r, cx + sw / 2), stem: r - l }; }
    return { ch, cw, l, r, stem: 0 };
  });
  // optical spacing: an I's serifs reach toward its neighbour, so it gets a little more air before it
  const gapBefore = (i: number) => (i === 0 ? 0 : gapPx + (ink[i]!.ch === 'I' ? size * 0.1 : 0));
  const inkW = ink.reduce((a, g, i) => a + (g.r - g.l) + gapBefore(i), 0);
  const w = Math.ceil(inkW) + 160;
  const Wd = w, Ht = H + 0;
  const cv = document.createElement('canvas');
  cv.width = Wd; cv.height = Ht;
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  c.fillStyle = '#000'; c.fillRect(0, 0, Wd, Ht);
  c.fillStyle = '#fff'; c.font = font(family, size); c.textBaseline = 'alphabetic';
  let xx = 80;
  const base = Ht / 2 + size * 0.343, cap = size * 0.686;
  const bounds: number[] = [];
  ink.forEach((g, i) => {
    xx += gapBefore(i);
    const ox = xx - g.l; // the glyph origin that puts its ink's left edge at xx
    c.fillText(g.ch, ox, base);
    if (g.ch === 'I') {
      const sw = g.stem * 1.9, sh = size * 0.1, cx = ox + g.cw / 2;
      c.fillRect(cx - sw / 2, base - cap, sw, sh);
      c.fillRect(cx - sw / 2, base - sh, sw, sh);
    }
    xx += g.r - g.l;
    bounds.push((xx + gapPx * 0.5) / Wd);
  });
  const img = c.getImageData(0, 0, Wd, Ht).data;
  const inside = new Uint8Array(Wd * Ht);
  for (let i = 0; i < Wd * Ht; i++) inside[i] = img[i * 4]! > 127 ? 1 : 0;
  const dOut = edt(inside, Wd, Ht, 0), dIn = edt(inside, Wd, Ht, 1);
  // signed distance with the antialiased coverage as a sub-pixel correction, then a small blur:
  // a binary raster's stair-steps would show as ridges on the extruded side walls
  let f = new Float32Array(Wd * Ht);
  for (let i = 0; i < Wd * Ht; i++) {
    const a = img[i * 4]! / 255;
    f[i] = Math.sqrt(dOut[i]!) - Math.sqrt(dIn[i]!) + (inside[i] ? a - 0.5 : a - 0.5) * -1;
  }
  const R = 3;
  for (let pass = 0; pass < 2; pass++) {
    const g = new Float32Array(Wd * Ht);
    for (let y = 0; y < Ht; y++) for (let x = 0; x < Wd; x++) {
      let acc = 0, n = 0;
      for (let k = -R; k <= R; k++) { const xx = Math.min(Wd - 1, Math.max(0, x + k)); acc += f[y * Wd + xx]!; n++; }
      g[y * Wd + x] = acc / n;
    }
    const h2 = new Float32Array(Wd * Ht);
    for (let y = 0; y < Ht; y++) for (let x = 0; x < Wd; x++) {
      let acc = 0, n = 0;
      for (let k = -R; k <= R; k++) { const yy = Math.min(Ht - 1, Math.max(0, y + k)); acc += g[yy * Wd + x]!; n++; }
      h2[y * Wd + x] = acc / n;
    }
    f = h2;
  }
  const data = new Float32Array(Wd * Ht * 4);
  for (let i = 0; i < Wd * Ht; i++) {
    const d = f[i]! / Ht; // in text-box heights
    data[i * 4] = d; data[i * 4 + 1] = d; data[i * 4 + 2] = d; data[i * 4 + 3] = 1;
  }
  const tex = new THREE.DataTexture(data, Wd, Ht, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.needsUpdate = true;
  return { tex, aspect: Wd / Ht, bounds };
}

/** Squared Euclidean distance to the nearest pixel whose `inside` != `target` (Felzenszwalb & Huttenlocher). */
function edt(inside: Uint8Array, w: number, h: number, target: number) {
  const INF = 1e20;
  const f = new Float64Array(Math.max(w, h)), d = new Float64Array(Math.max(w, h));
  const v = new Int32Array(Math.max(w, h)), z = new Float64Array(Math.max(w, h) + 1);
  const g = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = inside[i] === target ? INF : 0;
  const pass = (n: number) => {
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = ((f[q]! + q * q) - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
      while (s <= z[k]!) { k--; s = ((f[q]! + q * q) - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) { while (z[k + 1]! < q) k++; d[q] = (q - v[k]!) * (q - v[k]!) + f[v[k]!]!; }
  };
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = g[y * w + x]!; pass(h); for (let y = 0; y < h; y++) g[y * w + x] = d[y]!; }
  for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = g[y * w + x]!; pass(w); for (let x = 0; x < w; x++) g[y * w + x] = d[x]!; }
  return g;
}
