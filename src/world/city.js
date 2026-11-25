// The city around the library in AD 120: roofed colonnades (stoas) with shops lining the streets and the square.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { STREETS, PLAZA, streetPoint, streetLength, streetHeight } from './layout.js';
import { fullColumn, marble, strip } from './ruins.js';
import { patchMaterial } from './shaders.js';

const COL_H = 6.68;     // full column height, base to abacus
const DEPTH = 4.2;      // from the column line to the back wall
const SPACING = 4.2;

// Each run: a polyline, the side the stoa sits on (+1 left of travel, -1 right), and how far from the centre line.
function runs(opts) {
  const list = [];
  for (const street of opts.streets === false ? [] : STREETS) {
    const len = Math.min(streetLength(street), 190);
    for (const side of [-1, 1]) {
      const pts = [];
      for (let s = 8; s < len; s += SPACING) {
        const p = streetPoint(street, s);
        const nx = -p.dir[1] * side, nz = p.dir[0] * side, off = street.width / 2 + 0.9;
        const x = p.x + nx * off, z = p.z + nz * off;
        if (x > PLAZA.minX - 5 && x < PLAZA.maxX + 5 && z > PLAZA.minZ - 3 && z < PLAZA.maxZ + 4) continue;   // the square has its own colonnades
        pts.push({ x: p.x + nx * off, z: p.z + nz * off, y: streetHeight(street, s) - 0.05, nx, nz });
      }
      list.push(pts);
    }
  }
  // the square: colonnades along its long sides, facing inwards
  if (opts.plaza !== false) for (const side of [-1, 1]) {
    const pts = [];
    for (let z = PLAZA.minZ + 3; z <= PLAZA.maxZ - 2; z += SPACING) pts.push({ x: side * (side < 0 ? -PLAZA.minX : PLAZA.maxX) + side * 0.5, z, y: -0.05, nx: side, nz: 0 });
    list.push(pts);
  }
  return list;
}

export function addCity(parent, manager, opts = {}) {
  const mat = marble(manager);
  const wallMat = patchMaterial(new THREE.MeshStandardMaterial({ color: 0xc4a983, roughness: 0.92 }), { cloud: true, key: 'city-wall', extra: (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
  { float h = fract(vWorld.y / 0.45); gl_FragColor.rgb *= 0.9 + 0.1 * smoothstep(0.0, 0.08, min(h, 1.0 - h)); }`);
  } });
  const roofMat = patchMaterial(new THREE.MeshStandardMaterial({ color: 0x9c553a, roughness: 0.85 }), { cloud: true, key: 'city-roof' });
  const doorMat = new THREE.MeshBasicMaterial({ color: 0x2b1f16 });
  const awningMat = patchMaterial(new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide }), { cloud: true, wind: { strength: 0.04, height: 0.6 }, key: 'city-awning' });

  const cols = [], beams = [], walls = [], roofs = [], doors = [], awnings = [], awningColors = [];
  // yaw turns local z along the run; roll tilts about it (local x points across the run)
  const m4 = (x, y, z, yaw, sx, sy, sz, roll = 0) => new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, roll, 'YXZ')), new THREE.Vector3(sx, sy, sz));
  const palette = [0xb5523b, 0xd8c9a8, 0x3e5f86, 0xc9a24f, 0x6f7f4e];
  let k = 0;
  for (const pts of runs(opts)) {
    pts.forEach((p, i) => {
      cols.push(m4(p.x, p.y, p.z, 0, 1, 1, 1));
      const q = pts[i + 1];
      if (!q) return;
      // beam from this column to the next, then the shop wall and roof behind it
      const mx = (p.x + q.x) / 2, mz = (p.z + q.z) / 2, my = (p.y + q.y) / 2;
      const len = Math.hypot(q.x - p.x, q.z - p.z), yaw = Math.atan2(q.x - p.x, q.z - p.z);
      beams.push(m4(mx, my + COL_H, mz, yaw, 0.9, 0.75, len + 0.02));
      // which way local x points relative to the outward side, so roofs and awnings slope towards the street
      const out = Math.sign(p.nx * Math.cos(yaw) - p.nz * Math.sin(yaw)) || 1;
      const bx = mx + p.nx * DEPTH, bz = mz + p.nz * DEPTH;
      walls.push(m4(bx, my + 3.6, bz, yaw, 0.6, 7.2, len + 0.02));
      if (k++ % 2 === 0) {
        doors.push(m4(bx - p.nx * 0.31, my + 1.25, bz - p.nz * 0.31, yaw, 0.02, 2.5, 1.7));
        if (k % 3 === 0) {
          awnings.push(m4(bx - p.nx * 0.95, my + 2.7, bz - p.nz * 0.95, yaw, 1.4, 1, 2.6, 0.35 * out));
          awningColors.push(palette[k % palette.length]);
        }
      }
      // the roof runs from the top of the shop wall down onto the beam
      const pitch = Math.atan2(0.9, DEPTH);
      roofs.push(m4(mx + p.nx * DEPTH / 2, my + COL_H + 1.2, mz + p.nz * DEPTH / 2, yaw, DEPTH + 1.2, 0.18, len + 0.05, pitch * out));
    });
  }

  const group = new THREE.Group();
  group.name = 'city';
  const add = (geo, material, list, shadow = true, colors) => {
    const m = new THREE.InstancedMesh(geo, material, list.length);
    list.forEach((x, i) => m.setMatrixAt(i, x));
    if (colors) colors.forEach((c, i) => m.setColorAt(i, new THREE.Color(c)));
    m.castShadow = shadow;
    m.receiveShadow = true;
    m.computeBoundingSphere();
    group.add(m);
  };
  add(fullColumn(), mat, cols);
  add(strip(new RoundedBoxGeometry(1, 1, 1, 1, 0.04)).translate(0, 0.5, 0), mat, beams);
  add(new THREE.BoxGeometry(1, 1, 1), wallMat, walls);
  add(new THREE.BoxGeometry(1, 1, 1), roofMat, roofs);
  add(new THREE.BoxGeometry(1, 1, 1), doorMat, doors, false);
  // cloth awnings over some shop doors, tilted down towards the street
  const awn = new THREE.PlaneGeometry(1, 1, 1, 4).rotateX(-Math.PI / 2);
  add(awn, awningMat, awnings, true, awningColors);
  parent.add(group);
  return group;
}
