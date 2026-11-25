// Townspeople in tunics and mantles: walkers on the streets and the square, small groups talking by the library.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { heightAt } from './layout.js';
import { rng } from './noise.js';
import { patchMaterial } from './shaders.js';

const ROBES = [0xe8e0cf, 0xe3d9c4, 0xc29a52, 0xa4553b, 0x7a7a4a, 0x8a3b3b, 0x3e4f72, 0x6b4f3a, 0xd8cdb6, 0x9b7a4d];

// Routes people walk back and forth along (x, z), with how far they may stray sideways.
const ROUTES = [
  { spread: 3.2, points: [[1, 24], [4, 90], [8, 160]] },        // Marble Street
  { spread: 3.6, points: [[18, 12], [60, 2], [120, -20]] },      // Curetes Street
  { spread: 2.5, points: [[0, 6.2], [1, 24]] },                  // library steps to Marble Street
  { spread: 2.5, points: [[-3, 6.2], [10, 11], [18, 12]] },      // library steps to Curetes Street
  { spread: 6, points: [[-21, 15], [21, 15]] },                  // across the square
];

function personParts() {
  const pts = [[0, 0], [0.2, 0], [0.22, 0.05], [0.2, 0.5], [0.18, 0.95], [0.21, 1.25], [0.2, 1.38], [0.12, 1.46], [0.05, 1.5], [0, 1.5]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const robe = new THREE.LatheGeometry(pts, 14).scale(1, 1, 0.72);
  // a mantle thrown over the left shoulder, and arms
  const mantle = new THREE.CylinderGeometry(0.2, 0.235, 0.62, 12, 1, true).scale(1, 1, 0.75).rotateZ(0.32).translate(0.02, 1.08, 0);
  const armL = new THREE.CapsuleGeometry(0.05, 0.5, 3, 6).rotateZ(0.12).translate(-0.24, 1.08, 0.02);
  const armR = new THREE.CapsuleGeometry(0.05, 0.5, 3, 6).rotateZ(-0.12).translate(0.24, 1.08, 0.02);
  const shoulders = new THREE.SphereGeometry(0.22, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.15, 0.45, 0.75).translate(0, 1.34, 0);
  const head = new THREE.SphereGeometry(0.1, 12, 8).scale(1, 1.15, 1.05).translate(0, 1.6, 0.01);
  const neck = new THREE.CylinderGeometry(0.045, 0.05, 0.1, 8).translate(0, 1.5, 0);
  const strip = (g) => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k); return g.index ? g.toNonIndexed() : g; };
  return { robe: mergeGeometries([robe, mantle, armL, armR, shoulders].map(strip)), skin: mergeGeometries([strip(head), strip(neck)]) };
}

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
function groundY(x, z) {
  if (Math.abs(x) < 11 && z > -0.6 && z < 5.28) {
    if (z <= 2.4) return 1.53;
    return 1.53 - Math.floor((z - 2.4) / 0.32 + 1) * 0.17 + 0.17;
  }
  return Math.max(heightAt(x, z), 0);
}

export function addPeople(scene, count = 56) {
  const rand = rng(7);
  const parts = personParts();
  const robeMat = patchMaterial(new THREE.MeshStandardMaterial({ roughness: 0.85 }), { cloud: true, key: 'people-robe' });
  const skinMat = patchMaterial(new THREE.MeshStandardMaterial({ color: 0xb98a68, roughness: 0.7 }), { cloud: true, key: 'people-skin' });
  const groups = [[-6, 4.6], [5.5, 3.9], [-14, 12], [12, 20], [-4, 26]];
  const standing = groups.flatMap(([gx, gz], gi) => {
    const n = 3 + (gi % 2);
    return Array.from({ length: n }, (_, k) => {
      const a = (k / n) * Math.PI * 2 + gi;
      const x = gx + Math.cos(a) * 0.75, z = gz + Math.sin(a) * 0.75;
      return { x, z, face: Math.atan2(gx - x, gz - z), scale: 0.92 + rand() * 0.14, phase: rand() * 6 };
    });
  });
  const routes = ROUTES.map((r) => ({ ...r, ...routeTable(r.points) }));
  const walkers = Array.from({ length: count }, () => {
    const r = rand();   // most people are out on the long streets
    const route = routes[r < 0.36 ? 0 : r < 0.72 ? 1 : r < 0.8 ? 2 : r < 0.88 ? 3 : 4];
    return {
      route, s: rand() * route.total, dir: rand() < 0.5 ? 1 : -1,
      side: (rand() * 2 - 1) * route.spread, speed: 0.9 + rand() * 0.5,
      scale: rand() < 0.1 ? 0.68 : 0.92 + rand() * 0.14, phase: rand() * 6, pause: 0,
    };
  });

  const total = walkers.length + standing.length;
  const robes = new THREE.InstancedMesh(parts.robe, robeMat, total);
  const skins = new THREE.InstancedMesh(parts.skin, skinMat, total);
  const color = new THREE.Color();
  for (let i = 0; i < total; i++) robes.setColorAt(i, color.setHex(ROBES[Math.floor(rand() * ROBES.length)]));
  for (const m of [robes, skins]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); }

  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  const set = (i, x, y, z, yaw, roll, s) => {
    q.setFromEuler(e.set(0, yaw, roll, 'YXZ'));
    mtx.compose(pos.set(x, y, z), q, scl.set(s, s, s));
    robes.setMatrixAt(i, mtx);
    skins.setMatrixAt(i, mtx);
  };

  let last = 0;
  return (t) => {
    const dt = Math.min(t - last, 0.1);
    last = t;
    walkers.forEach((w, i) => {
      if (w.pause > 0) w.pause -= dt;
      else {
        w.s += w.dir * w.speed * dt;
        if (w.s < 0 || w.s > w.route.total) { w.dir *= -1; w.s = Math.min(Math.max(w.s, 0), w.route.total); w.pause = 1 + Math.random() * 4; }
      }
      const p = along(w.route, w.s);
      const x = p.x - p.dz * w.side, z = p.z + p.dx * w.side;
      const moving = w.pause <= 0;
      const step = moving ? t * w.speed * 5.5 + w.phase : 0;
      const bob = moving ? Math.abs(Math.sin(step)) * 0.035 : 0;
      set(i, x, groundY(x, z) + bob, z, Math.atan2(p.dx * w.dir, p.dz * w.dir), moving ? Math.sin(step) * 0.035 : 0, w.scale);
    });
    standing.forEach((p, k) => {
      // people in conversation shift their weight and turn a little now and then
      const turn = Math.sin(t * 0.3 + p.phase) * 0.25;
      set(walkers.length + k, p.x, groundY(p.x, p.z), p.z, p.face + turn, Math.sin(t * 0.7 + p.phase) * 0.02, p.scale);
    });
    robes.instanceMatrix.needsUpdate = true;
    skins.instanceMatrix.needsUpdate = true;
  };
}
