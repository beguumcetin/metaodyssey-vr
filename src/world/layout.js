// Ground plan of the current site (metres). The main monument stands at the origin and faces +z.
// One height function drives the terrain mesh and everything placed on it. Each site calls
// configureLayout() before the world is built; the defaults below are Ephesus.
import { fbm, smoothstep } from './noise.js';

export const PLAZA = { minX: -26, maxX: 26, minZ: -3, maxZ: 30, y: 0 };

// Streets as polylines; `rise` lifts the street by that many metres per metre after `flat` metres.
export const STREETS = [
  { name: 'marble', width: 9, flat: 999, rise: 0, points: [[1, 22], [4, 90], [10, 220]] },
  { name: 'curetes', width: 10, flat: 30, rise: 0.06, points: [[18, 12], [60, 2], [150, -28], [240, -70]] },
];

function rectDistance(x, z, r) {
  const dx = Math.max(r.minX - x, 0, x - r.maxX);
  const dz = Math.max(r.minZ - z, 0, z - r.maxZ);
  return Math.hypot(dx, dz);
}

// Distance from (x, z) to a street, the distance along it, and the unit direction there.
export function streetInfo(street, x, z) {
  let best = { dist: Infinity, along: 0, dir: [0, 1] }, walked = 0;
  const p = street.points;
  for (let i = 0; i < p.length - 1; i++) {
    const [ax, az] = p[i], [bx, bz] = p[i + 1];
    const lx = bx - ax, lz = bz - az, len = Math.hypot(lx, lz);
    const t = Math.min(Math.max(((x - ax) * lx + (z - az) * lz) / (len * len), 0), 1);
    const d = Math.hypot(x - (ax + lx * t), z - (az + lz * t));
    if (d < best.dist) best = { dist: d, along: walked + len * t, dir: [lx / len, lz / len] };
    walked += len;
  }
  return best;
}

export const streetHeight = (street, along) => Math.max(0, along - street.flat) * street.rise;

// Point and direction at distance `s` along a street.
export function streetPoint(street, s) {
  const p = street.points;
  for (let i = 0; i < p.length - 1; i++) {
    const [ax, az] = p[i], [bx, bz] = p[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (s <= len || i === p.length - 2) {
      const t = Math.min(s / len, 1);
      return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, dir: [(bx - ax) / len, (bz - az) / len] };
    }
    s -= len;
  }
}

export function streetLength(street) {
  let l = 0;
  for (let i = 0; i < street.points.length - 1; i++) {
    const [ax, az] = street.points[i], [bx, bz] = street.points[i + 1];
    l += Math.hypot(bx - ax, bz - az);
  }
  return l;
}

let hillsFn = ephesusHills;
let carveFn = null;

// open ground around monuments where no trees grow: [x, z, radius]
export const CLEARINGS = [];

export function configureLayout({ plaza, streets, hills, carve, clearings } = {}) {
  if (clearings) CLEARINGS.splice(0, CLEARINGS.length, ...clearings);
  if (plaza) Object.assign(PLAZA, plaza);
  if (streets) STREETS.splice(0, STREETS.length, ...streets);
  if (hills) hillsFn = hills;
  carveFn = carve || null;
}

const naturalHeight = (x, z) => hillsFn(x, z);

export function ephesusHills(x, z) {
  // Hills close behind the library, the valley opening out in front of it.
  const d = Math.hypot(x * 0.9, z < 0 ? z * 1.05 : z * 0.42);
  const hills = smoothstep(70, 360, d) * (30 + 170 * fbm(x * 0.0042 + 3.1, z * 0.0042 - 1.7));
  const r = Math.hypot(x, z);
  const range = smoothstep(650, 1700, r) * 330 * fbm(x * 0.0013 + 9.2, z * 0.0013 + 4.4, 4);
  const lumps = (fbm(x * 0.07, z * 0.07, 3) - 0.5) * 0.9;
  return hills + range + lumps;
}

// Ground height at (x, z), flattened under the plaza and the streets.
export function heightAt(x, z) {
  let h = naturalHeight(x, z);
  for (const s of STREETS) {
    const info = streetInfo(s, x, z);
    const w = smoothstep(s.width / 2 + 1, s.width / 2 + 28, info.dist);
    h = streetHeight(s, info.along) - 0.12 + (h - streetHeight(s, info.along)) * w;
  }
  const wp = smoothstep(3, 30, rectDistance(x, z, PLAZA));
  h = -0.12 * (1 - wp) + h * wp;
  return carveFn ? carveFn(x, z, h) : h;   // e.g. a river bed
}

// 0 = paved or bare, 1 = fully grassy, used to blend ground textures.
export function grassAt(x, z) {
  const r = Math.hypot(x, z);
  const n = fbm(x * 0.02 + 11, z * 0.02 - 5, 4);
  return Math.min(1, smoothstep(30, 120, r) * (0.35 + 0.9 * n) + smoothstep(0.55, 0.8, n) * 0.4);
}
