// A camera move as a smooth curve through keyframes in song time (pure function of t). Between keys the
// position, target and fov follow a C1 Hermite spline whose tangents come from the neighbouring keys
// (Catmull-Rom with non-uniform times), so the camera never jerks at a key; it starts and ends at rest.
export type CamKey = { t: number; pos: [number, number, number]; tgt: [number, number, number]; fov?: number };

export function camAt(t: number, keys: CamKey[]): { pos: [number, number, number]; tgt: [number, number, number]; fov: number } {
  const k0 = keys[0]!, kN = keys[keys.length - 1]!;
  const vec = (k: CamKey) => [...k.pos, ...k.tgt, k.fov ?? 30];
  if (t <= k0.t) return split(vec(k0));
  if (t >= kN.t) return split(vec(kN));
  let i = 0;
  while (i + 1 < keys.length - 1 && keys[i + 1]!.t <= t) i++;
  const a = keys[i]!, b = keys[i + 1]!;
  const pa = vec(a), pb = vec(b);
  const dt = b.t - a.t, u = (t - a.t) / dt;
  // tangents (per second); zero at the ends and at any key that repeats its neighbour (a hold)
  const tan = (j: number) => {
    if (j <= 0 || j >= keys.length - 1) return pa.map(() => 0);
    const p = vec(keys[j - 1]!), n = vec(keys[j + 1]!);
    return p.map((x, c) => (n[c]! - x) / (keys[j + 1]!.t - keys[j - 1]!.t));
  };
  const ma = tan(i), mb = tan(i + 1);
  const h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u, h01 = -2 * u ** 3 + 3 * u ** 2, h11 = u ** 3 - u ** 2;
  return split(pa.map((x, c) => h00 * x + h10 * dt * ma[c]! + h01 * pb[c]! + h11 * dt * mb[c]!));
}

function split(v: number[]) {
  return { pos: [v[0]!, v[1]!, v[2]!] as [number, number, number], tgt: [v[3]!, v[4]!, v[5]!] as [number, number, number], fov: v[6]! };
}
