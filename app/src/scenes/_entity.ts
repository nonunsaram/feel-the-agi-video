// The entity met behind the door (revision 5): something that could not exist — interlocked rings of
// liquid gold turning on different axes around a core of white light, set with points of light that open
// like eyes. It unfolds out of the door's slit: at `unfold` 0 every ring is seen edge-on as one vertical
// line of light (the I, the caret, the slit); at 1 they have turned open into a gyroscope the size of
// the sky. Ray-marched; pure function of the parameters.
import * as THREE from 'three';
import { FSPass, SS_TAP, SS_TAP_GLSL } from '../engine/gl';
import type { SceneCtx } from '../engine/scene';

const FRAG = /* glsl */ `
${SS_TAP_GLSL}
uniform float t, unfold, spin, eyes, pulse, level, opacity, scale, rays;
uniform vec3 camPos, camTgt;
uniform vec2 aspect;

mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1, 0, 0, 0, c, -s, 0, s, c); }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0, s, 0, 1, 0, -s, 0, c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, -s, 0, s, c, 0, 0, 0, 1); }

// ring i: radius, tube, its orientation (unfolds from edge-on/vertical to its own axis, then spins)
const int NR = 7;
float ringR(int i) { return 3.9 - float(i) * 0.46; }
mat3 ringM(int i) {
  float u = unfold;
  float fi = float(i);
  // folded (u = 0): every ring stands in the plane x = 0, seen edge-on from the camera — one vertical
  // line of light; it turns open toward its own orientation as u goes to 1
  mat3 m = rotZ(1.5708 * (1.0 - u)) * rotX(u * (0.35 + fi * 0.9)) * rotY(u * fi * 1.1);
  // and each keeps turning on its own axis
  m = m * rotY(spin * (0.6 + 0.35 * fi) * (mod(fi, 2.0) < 0.5 ? 1.0 : -1.0));
  return m;
}

vec3 sky(vec3 d) {
  float h = d.y;
  vec3 c = dawn(clamp(level * (0.55 + 0.6 * exp(-max(h + 0.05, 0.0) * 2.5)), 0.0, 1.0));
  return c;
}
vec3 envRefl(vec3 d) {
  vec3 c = C_INK * 0.2 + dawn(clamp(0.5 + 0.5 * level, 0.0, 1.0)) * exp(-pow((d.y - 0.02) / 0.09, 2.0)) * 2.2;
  c += C_PAPER * smoothstep(0.985, 1.0, abs(sin(atan(d.x, -d.z) * 2.0 + 0.4))) * smoothstep(-0.1, 0.4, d.y) * 1.4;
  c += C_GLOW * pow(max(dot(d, normalize(vec3(0.0, 0.3, 1.0))), 0.0), 30.0) * 4.0; // the core, seen in the gold
  return c;
}

// returns distance; id: 0 ring, 1 eye, 2 core
float map(vec3 p, out float id) {
  p /= scale;
  float d = length(p) - 0.42 * (1.0 + 0.25 * pulse); // the core
  id = 2.0;
  for (int i = 0; i < NR; i++) {
    vec3 q = transpose(ringM(i)) * p;
    float R = ringR(i);
    vec2 tq = vec2(length(q.xz) - R, q.y);
    float dr = length(tq) - (0.05 + 0.012 * float(i));
    if (dr < d) { d = dr; id = 0.0; }
    // eyes: points of light set into the ring's outer face
    float n = 30.0 - 3.0 * float(i);
    float a = atan(q.z, q.x);
    float ak = (floor(a / 6.28318 * n) + 0.5) * 6.28318 / n;
    vec3 c = vec3(cos(ak) * (R + 0.05), 0.0, sin(ak) * (R + 0.05));
    float de = length((q - c) * vec3(1.0, 1.0 / max(0.05, eyes), 1.0)) * max(0.05, eyes) - 0.075 * eyes;
    if (de < d) { d = de; id = 1.0; }
  }
  return d * scale;
}
float mapD(vec3 p) { float id; return map(p, id); }

vec4 shade(vec2 px) {
  vec2 uv = (px / vec2(1920.0, 1080.0)) * 2.0 - 1.0;
  uv.x *= aspect.x;
  vec3 ww = normalize(camTgt - camPos), uu = normalize(cross(ww, vec3(0, 1, 0))), vv = cross(uu, ww);
  vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.5 * ww);
  vec3 ro = camPos;
  float tt = 0.0, hit = -1.0, id = 0.0;
  float glow = 0.0;
  for (int i = 0; i < 140; i++) {
    vec3 p = ro + rd * tt;
    float d = map(p, id);
    // light gathered on the way: around the core, and a little around the eyes
    glow += exp(-max(length(p) - 0.4 * scale, 0.0) * 1.4 / scale) * 0.012;
    if (d < 0.0008 * tt) { hit = tt; break; }
    tt += d * 0.75;
    if (tt > 60.0) break;
  }
  vec3 col = sky(rd);
  float a = 0.0;
  if (hit > 0.0) {
    vec3 p = ro + rd * hit;
    vec2 e = vec2(0.003, 0.0);
    vec3 n = normalize(vec3(mapD(p + e.xyy) - mapD(p - e.xyy), mapD(p + e.yxy) - mapD(p - e.yxy), mapD(p + e.yyx) - mapD(p - e.yyx)));
    if (id > 1.5) col = vec3(1.0, 0.97, 0.9) * (6.0 + 6.0 * pulse);
    else if (id > 0.5) col = mix(C_GLOW, vec3(1.0), 0.5) * (2.0 + 6.0 * eyes) ;
    else {
      float fres = pow(1.0 - max(dot(-rd, n), 0.0), 3.0);
      vec3 r = envRefl(reflect(rd, n));
      col = r * vec3(1.0, 0.76, 0.42) * (0.75 + 0.6 * fres);
      // the core's light on the gold
      col += C_GLOW * max(dot(n, normalize(-p)), 0.0) * 1.4 * (1.0 + pulse);
    }
    a = 1.0;
  }
  col += mix(C_DAWN, C_GLOW, 0.6) * glow * (1.0 + 2.0 * pulse);
  // a crown of rays from the core (screen-space, around its projection)
  vec3 cdir = normalize(-ro);
  float cosA = dot(rd, cdir);
  vec3 side = normalize(rd - cdir * cosA);
  float ang = atan(dot(side, vv), dot(side, uu));
  float rays = pow(0.5 + 0.5 * sin(ang * 18.0 + t * 0.4), 10.0) + 0.6 * pow(0.5 + 0.5 * sin(ang * 7.0 - t * 0.25), 14.0);
  float rr = acos(clamp(cosA, -1.0, 1.0));
  col += C_GLOW * rays * exp(-rr * 5.0) * (0.6 + 1.5 * pulse) * unfold * rays;
  return vec4(col, 1.0);
}

void main() {
  vec4 acc = vec4(0.0);
  for (int k = ssK0(); k < ssK1(); k++) acc += shade(FRAG_PX + rgss(k));
  acc *= ssWeight();
  fragColor = vec4(acc.rgb * opacity, opacity);
}`;

export interface EntityParams {
  t: number; unfold: number; spin: number; eyes: number; pulse: number; level: number;
  cam: { pos: [number, number, number]; target: [number, number, number] };
  scale?: number; opacity?: number; rays?: number;
}

export class Entity {
  pass: FSPass;
  constructor() {
    this.pass = new FSPass(FRAG, {
      t: { value: 0 }, unfold: { value: 0 }, spin: { value: 0 }, eyes: { value: 0 }, pulse: { value: 0 }, level: { value: 0.6 },
      opacity: { value: 1 }, scale: { value: 1 }, rays: { value: 1 },
      camPos: { value: new THREE.Vector3(0, 0, 8) }, camTgt: { value: new THREE.Vector3() }, aspect: { value: new THREE.Vector2(16 / 9, 1) },
      ssTap: SS_TAP,
    }, { blending: THREE.CustomBlending, transparent: true });
    const m = this.pass.mat;
    m.blendEquation = THREE.AddEquation;
    m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor;
    m.blendSrcAlpha = THREE.OneFactor; m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
  }
  render(ctx: SceneCtx, out: THREE.WebGLRenderTarget, p: EntityParams) {
    const u = this.pass.u;
    u.t!.value = p.t; u.unfold!.value = p.unfold; u.spin!.value = p.spin; u.eyes!.value = p.eyes; u.pulse!.value = p.pulse;
    u.level!.value = p.level; u.opacity!.value = p.opacity ?? 1; u.scale!.value = p.scale ?? 1; u.rays!.value = p.rays ?? 1;
    (u.camPos!.value as THREE.Vector3).set(...p.cam.pos); (u.camTgt!.value as THREE.Vector3).set(...p.cam.target);
    this.pass.render(ctx.renderer, out);
  }
}
