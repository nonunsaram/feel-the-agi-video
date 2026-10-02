// The protagonist: a faceless pictogram person drawn as the outline of a body made of rounded
// capsules (like a public-signage figure). Posed by joint angles; poses change in snaps (stop-motion),
// never in long floaty tweens. Everything is a pure function of the pose passed in.
import { clamp, ease, lerp } from '../engine/util';
import { SCALE } from '../engine/gl';

/** Joint angles in radians (0 = limb pointing straight down; positive = toward the figure's left on screen = counter-clockwise). */
export interface Pose {
  /** torso lean (rotation about the hip) */ torso: number;
  head: number;
  lSh: number; lEl: number; rSh: number; rEl: number;
  lHip: number; lKn: number; rHip: number; rKn: number;
  /** hip height offset in units (negative = lower, e.g. sitting / crouching) */ drop: number;
}

export const POSE: Record<string, Pose> = {
  stand: { torso: 0, head: 0, lSh: 0.32, lEl: 0, rSh: -0.32, rEl: 0, lHip: 0.06, lKn: 0, rHip: -0.06, rKn: 0, drop: 0 },
  wait: { torso: 0.04, head: 0.12, lSh: 0.08, lEl: 0, rSh: -0.08, rEl: 0, lHip: 0.04, lKn: 0, rHip: -0.04, rKn: 0, drop: 0 },
  /** sitting upright on a chair, seen from the side (thighs level, shins down, hands on knees) */
  sitUp: { torso: -0.02, head: 0.04, lSh: 0.55, lEl: 0.9, rSh: 0.45, rEl: 0.95, lHip: 1.57, lKn: -1.57, rHip: 1.5, rKn: -1.5, drop: 0 },
  /** throwing something to the left (screen): right arm swept out */
  throwL: { torso: 0.12, head: 0.2, lSh: 0.3, lEl: 0, rSh: 1.9, rEl: 0.2, lHip: 0.25, lKn: -0.15, rHip: -0.2, rKn: 0, drop: 0 },
  /** sitting cross-legged on the ground (양반다리), facing us: knees out wide, shins crossed in front, hands
   * resting on the knees */
  crossLegged: { torso: 0, head: 0.04, lSh: 0.3, lEl: 0.3, rSh: -0.3, rEl: -0.3, lHip: 1.42, lKn: -2.78, rHip: -1.42, rKn: 2.78, drop: -1.9 },
  sit: { torso: 0.05, head: 0.25, lSh: 0.5, lEl: 1.1, rSh: -0.25, rEl: -0.6, lHip: 1.5, lKn: -1.5, rHip: 1.35, rKn: -1.4, drop: -0.95 },
  lookUp: { torso: -0.02, head: -0.06, lSh: 0.2, lEl: 0, rSh: -0.2, rEl: 0, lHip: 0.06, lKn: 0, rHip: -0.06, rKn: 0, drop: 0 },
  refuse: { torso: -0.12, head: -0.25, lSh: 0.9, lEl: 1.4, rSh: -0.9, rEl: -1.4, lHip: 0.12, lKn: 0, rHip: -0.12, rKn: 0, drop: 0 },
  crushed: { torso: 0.12, head: 0.35, lSh: 2.75, lEl: 1.5, rSh: -2.75, rEl: -1.5, lHip: 1.05, lKn: -2.0, rHip: -1.05, rKn: 2.0, drop: -1.2 },
  armsUp: { torso: 0, head: -0.1, lSh: 2.75, lEl: 0, rSh: -2.75, rEl: 0, lHip: 0.15, lKn: 0, rHip: -0.15, rKn: 0, drop: 0 },
  command: { torso: 0, head: 0.15, lSh: 1.15, lEl: 0, rSh: -1.15, rEl: 0, lHip: 0.2, lKn: 0, rHip: -0.2, rKn: 0, drop: 0 },
  point: { torso: 0, head: 0, lSh: 0.2, lEl: 0, rSh: -1.6, rEl: 0, lHip: 0.06, lKn: 0, rHip: -0.06, rKn: 0, drop: 0 },
  shrug: { torso: 0, head: 0.1, lSh: 0.9, lEl: -1.6, rSh: -0.9, rEl: 1.6, lHip: 0.06, lKn: 0, rHip: -0.06, rKn: 0, drop: 0 },
  walkA: { torso: 0.05, head: 0, lSh: -0.4, lEl: 0.2, rSh: 0.4, rEl: 0.2, lHip: 0.45, lKn: -0.1, rHip: -0.35, rKn: -0.45, drop: -0.05 },
  walkB: { torso: 0.05, head: 0, lSh: 0.4, lEl: 0.2, rSh: -0.4, rEl: 0.2, lHip: -0.35, lKn: -0.45, rHip: 0.45, rKn: -0.1, drop: -0.05 },
  cross: { torso: 0, head: 0.08, lSh: 0.5, lEl: -2.3, rSh: -0.5, rEl: 2.3, lHip: 0.1, lKn: 0, rHip: -0.1, rKn: 0, drop: 0 },
  glance: { torso: 0.08, head: 0.32, lSh: 0.1, lEl: 0, rSh: -0.25, rEl: 0.1, lHip: 0.3, lKn: -0.1, rHip: -0.25, rKn: -0.3, drop: -0.03 },
  reach: { torso: -0.05, head: -0.06, lSh: 0.2, lEl: 0, rSh: -2.2, rEl: 0.2, lHip: 0.08, lKn: 0, rHip: -0.08, rKn: 0, drop: 0 },
};

/** Blend two poses (k 0..1). */
export function mix(a: Pose, b: Pose, k: number): Pose {
  const o = {} as Pose;
  for (const key of Object.keys(a) as (keyof Pose)[]) o[key] = lerp(a[key], b[key], k);
  return o;
}

/**
 * Pose at time t from a list of [time, poseName] keys: holds each pose, snaps to the next over
 * `snap` seconds with a strong ease (stop-motion feel).
 */
export function poseAt(t: number, keys: [number, string][], snap = 0.11): Pose {
  if (!keys.length) return POSE.stand!;
  let i = 0;
  while (i + 1 < keys.length && keys[i + 1]![0] <= t) i++;
  // 'wave' is the only moving pose: a hello, the hand swinging side to side from the key's time on
  const P = (j: number) => keys[j]![1] === 'wave' ? waving(t, keys[j]![0]) : POSE[keys[j]![1]] ?? POSE.stand!;
  const cur = P(i);
  if (t < keys[0]![0]) return P(0);
  const prev = i > 0 ? P(i - 1) : cur;
  const k = ease.outExpo(clamp((t - keys[i]![0]) / snap));
  return mix(prev, cur, k);
}

/**
 * A hello (revision 8): the right forearm up beside the head, swinging side to side about the elbow
 * (never the stiff raised arm, which read as a salute or as worship). From time t0 on.
 */
export function waving(t: number, t0: number, base: Pose = POSE.stand!): Pose {
  const u = Math.max(0, t - t0);
  const sw = 0.36 * Math.sin(u * Math.PI * 2 * 2.1) * ease.outCubic(clamp(u / 0.25));
  return { ...base, head: 0.1, torso: 0.03, rSh: -1.95, rEl: -1.05 + sw, lSh: 0.18 };
}

// proportions in units of the figure's height (feet to top of head = 1)
const U = { head: 0.08, neck: 0.075, torso: 0.33, upperArm: 0.15, foreArm: 0.15, thigh: 0.205, shin: 0.205, limbW: 0.072, torsoW: 0.13, shoulder: 0.07, hip: 0.04 };

interface Seg { ax: number; ay: number; bx: number; by: number; w: number }

/** The capsules (and head circle) of a posed figure whose feet stand at (x, y) and is `h` px tall. */
function skeleton(x: number, y: number, h: number, p: Pose) {
  const segs: Seg[] = [];
  const dir = (a: number) => [Math.sin(a), Math.cos(a)] as const; // 0 = down
  const hipY = y - h * (U.thigh + U.shin) - p.drop * h * 0.22;
  const hip = { x, y: hipY };
  // legs
  const leg = (side: number, aHip: number, aKn: number) => {
    const hx = hip.x + side * h * U.hip;
    const [dx1, dy1] = dir(aHip);
    const kx = hx + dx1 * h * U.thigh, ky = hip.y + dy1 * h * U.thigh;
    const [dx2, dy2] = dir(aHip + aKn);
    const fx = kx + dx2 * h * U.shin, fy = ky + dy2 * h * U.shin;
    segs.push({ ax: hx, ay: hip.y, bx: kx, by: ky, w: h * U.limbW }, { ax: kx, ay: ky, bx: fx, by: fy, w: h * U.limbW });
  };
  leg(1, p.lHip, p.lKn);
  leg(-1, p.rHip, p.rKn);
  // torso (pointing up from the hip)
  const [tx, ty] = dir(Math.PI + p.torso);
  const sh = { x: hip.x + tx * h * U.torso, y: hip.y + ty * h * U.torso };
  segs.push({ ax: hip.x, ay: hip.y - h * 0.02, bx: sh.x, by: sh.y + h * 0.03, w: h * U.torsoW });
  // arms (from the shoulders, which sit a little below the top of the torso)
  const arm = (side: number, aSh: number, aEl: number) => {
    const sx = sh.x + side * h * U.shoulder, sy = sh.y + h * 0.055;
    const [dx1, dy1] = dir(aSh + p.torso);
    const ex = sx + dx1 * h * U.upperArm, ey = sy + dy1 * h * U.upperArm;
    const [dx2, dy2] = dir(aSh + aEl + p.torso);
    const wx = ex + dx2 * h * U.foreArm, wy = ey + dy2 * h * U.foreArm;
    segs.push({ ax: sx, ay: sy, bx: ex, by: ey, w: h * U.limbW * 0.92 }, { ax: ex, ay: ey, bx: wx, by: wy, w: h * U.limbW * 0.92 });
  };
  arm(1, p.lSh, p.lEl);
  arm(-1, p.rSh, p.rEl);
  // head: a separate circle above the neck gap
  const [nx, ny] = dir(Math.PI + p.torso + p.head);
  const hc = { x: sh.x + nx * h * (U.neck + U.head), y: sh.y + ny * h * (U.neck + U.head) };
  // ground the pose: the lowest point of the body (a foot, a knee) rests on the line y — no pose may
  // push a foot through the floor
  let low = -Infinity;
  for (const g of segs) low = Math.max(low, g.ay + g.w / 2, g.by + g.w / 2);
  const dy = y - low + h * U.limbW / 2 * 0; // (feet rest on y)
  for (const g of segs) { g.ay += dy; g.by += dy; }
  return { segs, head: { x: hc.x, y: hc.y + dy, r: h * U.head } };
}

function capsules(c: CanvasRenderingContext2D, segs: Seg[], extra: number) {
  c.lineCap = 'round';
  for (const s of segs) {
    c.lineWidth = s.w + extra;
    c.beginPath(); c.moveTo(s.ax, s.ay); c.lineTo(s.bx, s.by); c.stroke();
  }
}

let scratch: HTMLCanvasElement | null = null;
/** Default fill inside outline figures (set per scene: dark grey at night, paper by day). */
let figureFill: string | null = null;
export function setFigureFill(c: string | null) { figureFill = c; }

/**
 * Draw the figure. style 'line': the outline of the body (signage style), `lw` px thick, in `col`.
 * style 'fill': a solid silhouette in `col` (backlit).
 */
export function drawFigure(c: CanvasRenderingContext2D, x: number, y: number, h: number, p: Pose,
  o: { col: string; style?: 'line' | 'fill'; lw?: number; alpha?: number; fill?: string } = { col: '#fff' }) {
  const style = o.style ?? 'line', lw = o.lw ?? Math.max(1.5, h * 0.012);
  const { segs, head } = skeleton(x, y, h, p);
  c.save();
  c.globalAlpha *= o.alpha ?? 1;
  if (style === 'fill') {
    c.strokeStyle = o.col; c.fillStyle = o.col;
    capsules(c, segs, 0);
    c.beginPath(); c.arc(head.x, head.y, head.r, 0, Math.PI * 2); c.fill();
    c.restore();
    return;
  }
  // outline of the union: draw the body fat in the colour on a scratch canvas, then cut the body out
  const pad = h * 0.3 + lw * 2;
  const bx0 = Math.floor(x - h * 0.75 - pad), by0 = Math.floor(y - h * 1.25 - pad);
  const bw = Math.ceil(h * 1.5 + 2 * pad), bh = Math.ceil(h * 1.6 + 2 * pad);
  const tf = c.getTransform();
  const sc = Math.hypot(tf.a, tf.b) * SCALE;
  if (!scratch) scratch = document.createElement('canvas');
  const k = Math.max(1, sc);
  scratch.width = Math.ceil(bw * k); scratch.height = Math.ceil(bh * k);
  const s = scratch.getContext('2d')!;
  s.setTransform(k, 0, 0, k, -bx0 * k, -by0 * k);
  s.clearRect(bx0, by0, bw, bh);
  s.strokeStyle = o.col; s.fillStyle = o.col;
  capsules(s, segs, lw * 2);
  s.beginPath(); s.arc(head.x, head.y, head.r + lw, 0, Math.PI * 2); s.fill();
  // the inside: solid (so nothing behind shows through the body), or cut out when no fill is given
  const fill = o.fill === undefined ? (figureFill ?? null) : o.fill;
  if (fill) { s.strokeStyle = fill; s.fillStyle = fill; }
  else s.globalCompositeOperation = 'destination-out';
  capsules(s, segs, 0);
  s.beginPath(); s.arc(head.x, head.y, head.r, 0, Math.PI * 2); s.fill();
  s.globalCompositeOperation = 'source-over';
  c.drawImage(scratch, bx0, by0, bw, bh);
  c.restore();
}
