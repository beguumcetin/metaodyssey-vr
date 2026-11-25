// Townspeople of Roman Ephesus. Each figure is jointed (thighs, shins, arms) so it can walk with bending knees,
// talk with its hands, or sit on the library steps. Every body part is one InstancedMesh shared by all people.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { heightAt } from './layout.js';
import { rng } from './noise.js';
import { patchMaterial } from './shaders.js';

// Natural dyes of the period: undyed wool and linen, madder red, weld yellow, woad blue, walnut brown.
const CLOTH = [0xe9e1cf, 0xe4dac4, 0xd9cdb3, 0xcbb894, 0xa9503a, 0x8e3a32, 0xc79c48, 0x46608a, 0x5b6b45, 0x6e5440, 0x9a7a52, 0xb7a17a];
const MANTLE = [0xf0e9da, 0xd8cbb0, 0x7e3a33, 0x3d5478, 0x6b4a33, 0xa88a55, 0x56603f, 0x8f6b8a];
const SKIN = [0xc99a78, 0xb98a68, 0xa87a58, 0xd2a888, 0x9a6c4e];
const HAIR = [0x2a1d16, 0x3b2a1e, 0x1d1714, 0x5a4030, 0x7a7068, 0x4a3426];

const HIP_Y = 0.86, HIP_X = 0.09, THIGH = 0.42, SHIN = 0.42;
const SHOULDER_Y = 1.37, SHOULDER_X = 0.205;

const clean = (g) => {
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
  return g.index ? g.toNonIndexed() : g;
};
const lathe = (pts, seg = 18) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

function bodyParts(female) {
  // torso from the waist to the neck, with shoulders; flattened front to back
  const torso = lathe([[0, 0.9], [0.15, 0.9], [0.155, 1.02], [0.17, 1.2], [0.2, 1.33], [0.19, 1.4], [0.1, 1.45], [0.05, 1.47], [0, 1.47]]).scale(1, 1, 0.68);
  // skirt of the tunic (knee length) or the stola (ankle length), flaring gently
  const skirt = female
    ? lathe([[0, 0.05], [0.27, 0.05], [0.25, 0.2], [0.2, 0.6], [0.16, 0.93], [0, 0.93]]).scale(1, 1, 0.8)
    : lathe([[0, 0.47], [0.22, 0.47], [0.19, 0.7], [0.16, 0.93], [0, 0.93]]).scale(1, 1, 0.78);
  // a mantle: the toga-like pallium over the left shoulder for men, a palla around the shoulders for women
  // the outer garment wraps the body: a pallium down to the thighs for men, a palla over the shoulders for women
  const mantle = female
    ? lathe([[0, 1.02], [0.185, 1.02], [0.2, 1.2], [0.222, 1.33], [0.2, 1.415], [0.11, 1.455], [0, 1.455]]).scale(1, 1, 0.72)
    : lathe([[0, 0.6], [0.215, 0.6], [0.2, 0.9], [0.19, 1.05], [0.205, 1.22], [0.225, 1.335], [0.2, 1.415], [0.11, 1.455], [0, 1.455]]).scale(1, 1, 0.72);
  const head = mergeGeometries([
    clean(new THREE.SphereGeometry(0.105, 18, 14).scale(0.94, 1.14, 1.04).translate(0, 1.6, 0)),
    clean(new THREE.CylinderGeometry(0.045, 0.052, 0.14, 10).translate(0, 1.49, 0)),
    clean(new THREE.ConeGeometry(0.018, 0.05, 6).rotateX(Math.PI / 2).translate(0, 1.59, 0.112)),   // nose
    clean(new THREE.SphereGeometry(0.022, 8, 6).scale(0.6, 1, 0.6).translate(-0.1, 1.6, 0)),          // ears
    clean(new THREE.SphereGeometry(0.022, 8, 6).scale(0.6, 1, 0.6).translate(0.1, 1.6, 0)),
  ]);
  const hairParts = [clean(new THREE.SphereGeometry(0.113, 16, 10, 0, Math.PI * 2, 0, Math.PI * (female ? 0.6 : 0.5)).scale(0.96, 1.12, 1.08).translate(0, 1.615, -0.012))];
  if (female) hairParts.push(clean(new THREE.SphereGeometry(0.055, 10, 8).translate(0, 1.6, -0.12)));   // bun
  const hair = mergeGeometries(hairParts);
  // limbs hang from their joint at the origin
  const thigh = new THREE.CapsuleGeometry(0.068, THIGH - 0.1, 3, 8).translate(0, -THIGH / 2, 0);
  const shin = mergeGeometries([
    clean(new THREE.CapsuleGeometry(0.05, SHIN - 0.1, 3, 8).translate(0, -SHIN / 2, 0)),
  ]);
  const sandal = new THREE.BoxGeometry(0.085, 0.04, 0.22).translate(0, -SHIN - 0.04, 0.045);
  const arm = mergeGeometries([
    clean(new THREE.CylinderGeometry(0.042, 0.034, 0.52, 8).translate(0, -0.29, 0)),
    clean(new THREE.SphereGeometry(0.042, 8, 6).translate(0, -0.03, 0)),
    clean(new THREE.SphereGeometry(0.045, 8, 6).scale(0.75, 1.25, 0.55).translate(0, -0.6, 0.01)),   // hand
  ]);
  const sleeve = new THREE.CylinderGeometry(0.06, 0.065, 0.16, 10, 1, true).translate(0, -0.06, 0);
  return { torso, skirt, mantle, head, hair, thigh, shin, sandal, arm, sleeve };
}

// Routes people walk back and forth along (x, z), with how far they may stray sideways.
const ROUTES = [
  { spread: 3.0, points: [[1, 24], [4, 90], [8, 160]] },        // Marble Street
  { spread: 3.4, points: [[18, 12], [60, 2], [120, -20]] },      // Curetes Street
  { spread: 2.0, points: [[0, 6.2], [1, 24]] },                  // library steps to Marble Street
  { spread: 2.0, points: [[-3, 6.2], [10, 11], [18, 12]] },      // library steps to Curetes Street
  { spread: 6, points: [[-21, 15], [21, 15]] },                  // across the square
];

function routeTable(points) {
  const segs = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i], [bx, bz] = points[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    segs.push({ ax, az, dx: (bx - ax) / len, dz: (bz - az) / len, len, start: total });
    total += len;
  }
  return { segs, total };
}

function along(route, s) {
  const seg = route.segs.find((g) => s <= g.start + g.len) || route.segs[route.segs.length - 1];
  const u = s - seg.start;
  return { x: seg.ax + seg.dx * u, z: seg.az + seg.dz * u, dx: seg.dx, dz: seg.dz };
}

// Height of the library steps and podium, so people standing there are not buried.
export function groundY(x, z) {
  if (Math.abs(x) < 11 && z > -0.6 && z < 5.28) {
    if (z <= 2.4) return 1.53;
    return 1.53 - Math.floor((z - 2.4) / 0.32) * 0.17;
  }
  return Math.max(heightAt(x, z), 0);
}

export function addPeople(parent) {
  const rand = rng(7);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const people = [];
  const make = (extra) => {
    const female = rand() < 0.42;
    const child = rand() < 0.08;
    people.push({
      female, scale: child ? 0.66 : (female ? 0.92 : 0.98) + rand() * 0.09,
      cloth: pick(CLOTH), mantle: rand() < 0.75 ? pick(MANTLE) : null, skin: pick(SKIN), hair: female ? pick(HAIR.slice(0, 4)) : pick(HAIR),
      phase: rand() * 6.28, ...extra,
    });
  };

  // walkers
  const routes = ROUTES.map((r) => ({ ...r, ...routeTable(r.points) }));
  for (let i = 0; i < 46; i++) {
    const r = rand();
    const route = routes[r < 0.36 ? 0 : r < 0.7 ? 1 : r < 0.8 ? 2 : r < 0.88 ? 3 : 4];
    make({ mode: 'walk', route, s: rand() * route.total, dir: rand() < 0.5 ? 1 : -1, side: (rand() * 2 - 1) * route.spread, speed: 1.0 + rand() * 0.35, pause: 0 });
  }
  // groups in conversation, facing their centre
  for (const [gx, gz, n] of [[-6.5, 3.0, 3], [6, 3.6, 2], [-14, 12, 4], [12, 20, 3], [-4, 24, 3], [16, 9, 2], [-20, 6, 3]]) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + gx;
      const x = gx + Math.cos(a) * 0.7, z = gz + Math.sin(a) * 0.7;
      make({ mode: 'talk', x, z, face: Math.atan2(gx - x, gz - z), speaker: k === 0 });
    }
  }
  // readers sitting on the steps of the library, facing the square
  for (const [x, step] of [[-8.6, 1], [-3.8, 2], [3.2, 1], [8.4, 3], [0.9, 4]]) {
    make({ mode: 'sit', x, z: 2.4 + (step + 1) * 0.32 - 0.1, step, face: (rand() - 0.5) * 0.5 });
  }

  // ---- meshes ----
  const mat = (key) => patchMaterial(new THREE.MeshStandardMaterial({ roughness: 0.82, side: key === 'cloth' ? THREE.DoubleSide : THREE.FrontSide }), { cloud: true, key: 'people-' + key });
  const cloth = mat('cloth'), skin = mat('skin'), hair = mat('hair'), dark = mat('dark');
  dark.color.setHex(0x3a2a1e);
  const n = people.length;
  const meshes = {};
  const parts = { m: bodyParts(false), f: bodyParts(true) };
  const layout = [
    ['torso', cloth, 'cloth'], ['skirt', cloth, 'cloth'], ['mantle', cloth, 'mantle'], ['head', skin, 'skin'], ['hair', hair, 'hair'],
    ['thighL', skin, 'skin', 'thigh'], ['thighR', skin, 'skin', 'thigh'], ['shinL', skin, 'skin', 'shin'], ['shinR', skin, 'skin', 'shin'],
    ['sandalL', dark, null, 'sandal'], ['sandalR', dark, null, 'sandal'],
    ['armL', skin, 'skin', 'arm'], ['armR', skin, 'skin', 'arm'], ['sleeveL', cloth, 'cloth', 'sleeve'], ['sleeveR', cloth, 'cloth', 'sleeve'],
  ];
  const color = new THREE.Color();
  for (const sex of ['m', 'f']) {
    const idx = people.map((p, i) => ((p.female ? 'f' : 'm') === sex ? i : -1)).filter((i) => i >= 0);
    meshes[sex] = { idx, parts: {} };
    for (const [name, material, tint, geoName] of layout) {
      const m = new THREE.InstancedMesh(parts[sex][geoName || name], material, idx.length);
      idx.forEach((pi, k) => {
        const p = people[pi];
        let c = tint === 'mantle' ? (p.mantle ?? p.cloth) : p[tint];
        if (p.mode === 'sit' && name.startsWith('thigh')) c = p.cloth;   // the tunic covers the lap
        if (p.female && (name.startsWith('thigh') || name.startsWith('shin'))) c = p.cloth;   // legs moving inside a long stola read as folds
        if (tint) m.setColorAt(k, color.setHex(c));
      });
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      meshes[sex].parts[name] = m;
      parent.add(m);
    }
  }
  // people without a mantle simply have it folded away (scaled to nothing)
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

  // ---- pose ----
  const root = new THREE.Matrix4(), tmp = new THREE.Matrix4(), joint = new THREE.Matrix4();
  const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  const local = (x, y, z, rx = 0, rz = 0) => joint.compose(v.set(x, y, z), q.setFromEuler(e.set(rx, 0, rz)), s.set(1, 1, 1));

  function pose(sexMeshes, k, p, P) {
    const set = (name, m) => sexMeshes.parts[name].setMatrixAt(k, m);
    const { legL, legR, kneeL, kneeR, armL, armR, armOutL = 0.06, armOutR = 0.06, lean = 0, seat = false } = P;
    // upper body, leaning slightly into the stride
    const upper = tmp.copy(root).multiply(local(0, HIP_Y, 0, lean)).multiply(local(0, -HIP_Y, 0));
    set('torso', upper);
    set('head', upper);
    set('hair', upper);
    set('mantle', p.mantle && !seat ? upper : ZERO);
    if (seat) set('skirt', new THREE.Matrix4().copy(upper).multiply(local(0, 0.93, 0)).multiply(new THREE.Matrix4().makeScale(1, 0.18, 1)).multiply(local(0, -0.93, 0)));
    else set('skirt', upper);
    for (const [side, sx, th, kn] of [['L', -1, legL, kneeL], ['R', 1, legR, kneeR]]) {
      const hip = new THREE.Matrix4().copy(root).multiply(local(sx * HIP_X, HIP_Y, 0, th));
      set('thigh' + side, hip);
      const knee = hip.clone().multiply(local(0, -THIGH, 0, kn));
      set('shin' + side, knee);
      set('sandal' + side, knee);
    }
    for (const [side, sx, a, out] of [['L', -1, armL, armOutL], ['R', 1, armR, armOutR]]) {
      const sh = upper.clone().multiply(local(sx * SHOULDER_X, SHOULDER_Y, 0, a, sx * out));
      set('arm' + side, sh);
      set('sleeve' + side, sh);
    }
  }

  let last = 0;
  return (t) => {
    const dt = Math.min(t - last, 0.1);
    last = t;
    for (const sex of ['m', 'f']) {
      const sm = meshes[sex];
      sm.idx.forEach((pi, k) => {
        const p = people[pi];
        let x, z, yaw, y, P;
        if (p.mode === 'walk') {
          if (p.pause > 0) p.pause -= dt;
          else {
            p.s += p.dir * p.speed * dt;
            if (p.s < 0 || p.s > p.route.total) { p.dir *= -1; p.s = Math.min(Math.max(p.s, 0), p.route.total); p.pause = 1 + Math.random() * 4; }
          }
          const a = along(p.route, p.s);
          x = a.x - a.dz * p.side; z = a.z + a.dx * p.side;
          yaw = Math.atan2(a.dx * p.dir, a.dz * p.dir);
          if (p.pause > 0) {
            P = { legL: 0, legR: 0, kneeL: 0, kneeR: 0, armL: 0.05, armR: 0.05 };
            y = groundY(x, z);
          } else {
            // the stride follows the distance walked, so feet do not slide
            const ph = (p.s * p.dir) / (0.68 * p.scale) * Math.PI + p.phase;
            const sw = Math.sin(ph);
            P = {
              legL: -0.42 * sw, legR: 0.42 * sw,
              kneeL: 0.75 * Math.max(0, Math.sin(ph - 1.2)), kneeR: 0.75 * Math.max(0, Math.sin(ph + Math.PI - 1.2)),
              armL: 0.32 * sw, armR: -0.32 * sw, lean: -0.05,
            };
            y = groundY(x, z) + Math.abs(Math.cos(ph)) * 0.025 * p.scale;
          }
        } else if (p.mode === 'talk') {
          x = p.x; z = p.z; y = groundY(x, z);
          yaw = p.face + Math.sin(t * 0.25 + p.phase) * 0.2;
          // the speaker gestures; listeners shift their weight and sometimes fold their arms
          const g = p.speaker || Math.sin(t * 0.2 + p.phase) > 0.6 ? 1 : 0;
          P = {
            legL: -0.05, legR: 0.08 + Math.sin(t * 0.4 + p.phase) * 0.04, kneeL: 0.05, kneeR: 0.12,
            armL: g ? -0.5 - 0.35 * Math.sin(t * 2.1 + p.phase) : 0.08, armR: -0.25 - 0.1 * Math.sin(t * 0.8 + p.phase),
            armOutL: g ? 0.25 + 0.15 * Math.sin(t * 1.3 + p.phase) : 0.06, armOutR: -0.15,
          };
        } else {
          // sitting on a step: thighs forward, shins down to the step below, reading a scroll held in both hands
          x = p.x; z = p.z; yaw = p.face;
          y = 1.53 - p.step * 0.17 - HIP_Y + 0.07;
          P = {
            legL: -1.45, legR: -1.35, kneeL: 1.1, kneeR: 0.95, seat: true, lean: 0.12,
            armL: -1.0 + Math.sin(t * 0.3 + p.phase) * 0.05, armR: -1.0, armOutL: -0.3, armOutR: 0.3,
          };
        }
        root.compose(v.set(x, y, z), q.setFromEuler(e.set(0, yaw, 0)), s.setScalar(p.scale));
        pose(sm, k, p, P);
      });
      for (const m of Object.values(sm.parts)) m.instanceMatrix.needsUpdate = true;
    }
  };
}
