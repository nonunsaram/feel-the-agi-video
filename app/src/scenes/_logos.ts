// Wireframe emblems for the three names in the hook (revision 6): line drawings in the video's own
// idiom, evoking each mark — a six-loop knot, a starburst, a four-point sparkle — extruded into thin 3D
// wireframes and projected with a simple camera. Drawn with Canvas2D strokes (on the Light layer they glow).
export type P3 = [number, number, number];
export type Poly = P3[];

const TAU = Math.PI * 2;

/** Outline of a capsule (stadium) of length L and width w, centred at the origin along x. */
function capsule(L: number, w: number, n = 18): [number, number][] {
  const r = w / 2, a = L / 2 - r, pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) { const t = -Math.PI / 2 + (Math.PI * i) / n; pts.push([a + r * Math.cos(t), r * Math.sin(t)]); }
  for (let i = 0; i <= n; i++) { const t = Math.PI / 2 + (Math.PI * i) / n; pts.push([-a + r * Math.cos(t), r * Math.sin(t)]); }
  pts.push(pts[0]!);
  return pts;
}

/** Outline of a rounded rectangle (w x h, corner radius r), centred at the origin. */
function rrect(w: number, h: number, r: number, n = 6): [number, number][] {
  const pts: [number, number][] = [];
  const cs: [number, number, number][] = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, 1], [-w / 2 + r, -h / 2 + r, 2], [w / 2 - r, -h / 2 + r, 3]];
  for (const [cx, cy, q] of cs) for (let i = 0; i <= n; i++) { const t = (q + i / n) * Math.PI / 2; pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
  pts.push(pts[0]!);
  return pts;
}

/** A knot of six interlocking bands (each band = an outer and an inner rounded outline). */
function knot(): [number, number][][] {
  const out: [number, number][][] = [];
  for (let k = 0; k < 6; k++) {
    const a = (k * TAU) / 6 + Math.PI / 6;
    const c = Math.cos(a), s = Math.sin(a);
    const ox = -Math.sin(a) * 0.27, oy = Math.cos(a) * 0.27;
    for (const [w, h, r] of [[1.0, 0.46, 0.23]] as const)
      out.push(rrect(w, h, r).map(([x, y]) => [x * c - y * s + ox, x * s + y * c + oy]));
  }
  return out;
}

/** A starburst: one outline of twelve rounded rays of uneven length meeting in the middle. */
function burst(): [number, number][][] {
  const n = 12, L = [1, 0.8, 0.95, 0.72, 1, 0.84, 0.9, 0.74, 0.97, 0.8, 0.88, 0.76];
  const p: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    const a = (k * TAU) / n, half = (TAU / n) * 0.5, tipR = 0.065;
    // valley before the ray
    const va = a - half;
    p.push([Math.cos(va) * 0.2, Math.sin(va) * 0.2]);
    // rounded tip
    const tx = Math.cos(a) * (L[k]! - tipR), ty = Math.sin(a) * (L[k]! - tipR);
    for (let i = 0; i <= 8; i++) { const t = a - Math.PI / 2 + (Math.PI * i) / 8; p.push([tx + tipR * Math.cos(t), ty + tipR * Math.sin(t)]); }
  }
  p.push(p[0]!);
  return [p];
}

/** A four-point sparkle with concave sides. */
function sparkle(): [number, number][][] {
  const p: [number, number][] = [];
  for (let i = 0; i <= 96; i++) {
    const t = (i / 96) * TAU;
    const c = Math.cos(t), s = Math.sin(t);
    p.push([Math.sign(c) * Math.abs(c) ** 2.6, Math.sign(s) * Math.abs(s) ** 2.6]);
  }
  const inner = p.map(([x, y]) => [x * 0.55, y * 0.55] as [number, number]);
  return [p, inner];
}

const SHAPES = { chatgpt: knot(), claude: burst(), gemini: sparkle() };
export type Emblem = keyof typeof SHAPES;

/** Extrude 2D outlines to a wireframe: front and back copies, and struts every few points. */
function wire(shape: [number, number][][], depth = 0.16): Poly[] {
  const out: Poly[] = [];
  for (const ring of shape) {
    out.push(ring.map(([x, y]) => [x, y, depth / 2] as P3));
    out.push(ring.map(([x, y]) => [x, y, -depth / 2] as P3));
    for (let i = 0; i < ring.length - 1; i += 14) { const [x, y] = ring[i]!; out.push([[x, y, depth / 2], [x, y, -depth / 2]]); }
  }
  return out;
}
const WIRES: Record<Emblem, Poly[]> = { chatgpt: wire(SHAPES.chatgpt, 0.08), claude: wire(SHAPES.claude), gemini: wire(SHAPES.gemini) };

export interface EmblemDraw {
  /** centre on screen (px) and size (px for 1 unit) */ x: number; y: number; size: number;
  /** rotation (radians) about the vertical and horizontal axes, and in the plane */ yaw?: number; pitch?: number; roll?: number;
  /** 0..1 how much of each line is drawn (draw-on) */ draw?: number;
  /** perspective strength (0 = orthographic) */ persp?: number;
  lw?: number; col?: string;
}

/** Draw one emblem's wireframe. */
export function drawEmblem(c: CanvasRenderingContext2D, name: Emblem, o: EmblemDraw) {
  const yaw = o.yaw ?? 0, pitch = o.pitch ?? 0, roll = o.roll ?? 0, draw = o.draw ?? 1, persp = o.persp ?? 0.25;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  const proj = ([x0, y0, z0]: P3): [number, number] => {
    let x = x0 * cr - y0 * sr, y = x0 * sr + y0 * cr, z = z0;
    [x, z] = [x * cy + z * sy, -x * sy + z * cy];
    [y, z] = [y * cp - z * sp, y * sp + z * cp];
    const k = 1 / (1 - z * persp);
    return [o.x + x * o.size * k, o.y - y * o.size * k];
  };
  c.save();
  c.strokeStyle = o.col ?? 'rgba(255,255,255,1)';
  c.lineWidth = o.lw ?? 2;
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.beginPath();
  for (const poly of WIRES[name]) {
    const n = Math.max(2, Math.ceil(poly.length * draw));
    if (draw <= 0) break;
    poly.slice(0, n).forEach((p, i) => { const [x, y] = proj(p); if (i) c.lineTo(x, y); else c.moveTo(x, y); });
  }
  c.stroke();
  c.restore();
}
