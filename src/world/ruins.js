// Marble columns, statue bases and scattered blocks along the streets.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { STREETS, streetPoint, streetLength, streetHeight, heightAt } from './layout.js';
import { rng, noise2 } from './noise.js';
import { patchMaterial } from './shaders.js';

const R = 0.38;   // column radius (m)

function fluted(h, r0, r1, broken, seed) {
  const g = new THREE.CylinderGeometry(r1, r0, h, 48, Math.max(2, Math.round(h * 2)), false);
  g.translate(0, h / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = p.getY(i);
    const a = Math.atan2(z, x), rad = Math.hypot(x, z);
    if (rad < 1e-4) continue;
    const k = 1 - 0.06 * Math.pow(Math.abs(Math.sin(a * 12)), 0.6);
    let ny = y;
    if (broken && y > h - 0.01) ny = h - 0.12 - 0.45 * noise2(Math.cos(a) * 1.5 + seed, Math.sin(a) * 1.5);
    p.setXYZ(i, (x / rad) * rad * k, ny, (z / rad) * rad * k);
  }
  g.computeVertexNormals();
  return g;
}

function base() {
  const plinth = new RoundedBoxGeometry(1.05, 0.28, 1.05, 2, 0.03).translate(0, 0.14, 0);
  const torus = new THREE.CylinderGeometry(0.47, 0.5, 0.16, 40).translate(0, 0.36, 0);
  const scotia = new THREE.CylinderGeometry(0.42, 0.44, 0.1, 40).translate(0, 0.49, 0);
  return [plinth, torus, scotia].map((g) => g.index ? g.toNonIndexed() : g);
}

function capital() {
  const echinus = new THREE.CylinderGeometry(0.5, 0.36, 0.25, 40).translate(0, 0.12, 0);
  const abacus = new RoundedBoxGeometry(1.15, 0.16, 1.0, 2, 0.02).translate(0, 0.33, 0);
  const volL = new THREE.TorusGeometry(0.15, 0.07, 8, 20).translate(-0.48, 0.12, 0).rotateY(0);
  const volR = new THREE.TorusGeometry(0.15, 0.07, 8, 20).translate(0.48, 0.12, 0);
  return [echinus, abacus, volL, volR].map((g) => g.index ? g.toNonIndexed() : g);
}

function strip(g) {   // keep only position/normal/uv so parts can merge
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  return g.index ? g.toNonIndexed() : g;
}

function fullColumn() {
  const shaft = fluted(5.6, R, R * 0.86, false, 0).translate(0, 0.54, 0);
  const cap = capital().map((g) => g.translate(0, 6.14, 0));
  return mergeGeometries([...base(), shaft, ...cap].map(strip));
}

function stumpShaft(seed) {
  return strip(fluted(1, R, R * 0.97, true, seed));
}

function marble(manager) {
  const loader = new THREE.TextureLoader(manager);
  const map = loader.load('assets/tex/marble_01_diff.jpg');
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(0.35, 0.6);
  const mat = new THREE.MeshStandardMaterial({ map, color: 0xf1ebe0, roughness: 0.72 });
  return patchMaterial(mat, { cloud: true, dirt: true, key: 'marble' });
}

export function addRuins(scene, manager) {
  const rand = rng(31);
  const mat = marble(manager);
  const full = [], bases = [], shafts = [], pedestals = [], drums = [], blocks = [];
  const place = (list, x, y, z, rotY, sx = 1, sy = 1, sz = 1, tilt = 0) => list.push(new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, rotY, 0, 'YXZ')), new THREE.Vector3(sx, sy, sz)));

  for (const street of STREETS) {
    const len = Math.min(streetLength(street), 190);
    for (const side of [-1, 1]) {
      for (let s = 8; s < len; s += 4.2) {
        const p = streetPoint(street, s);
        const nx = -p.dir[1], nz = p.dir[0];
        const off = street.width / 2 + 0.9;
        const x = p.x + nx * off * side, z = p.z + nz * off * side;
        const y = streetHeight(street, s) - 0.05;
        const roll = rand();
        if (roll < 0.16) place(full, x, y, z, rand() * 6);
        else if (roll < 0.72) {
          const r = rand() * 6;
          place(bases, x, y, z, r);
          place(shafts, x, y + 0.54, z, r, 1, 0.3 + rand() * 2.6, 1);
        }
        else if (roll < 0.8) {
          // fallen drum lying next to its base
          place(bases, x, y, z, rand() * 6);
          const d = 1.3 + rand();
          place(drums, x + nx * side * d, heightAt(x + nx * side * d, z + nz * side * d) + R * 0.9, z + nz * side * d,
            Math.atan2(p.dir[0], p.dir[1]) + (rand() - 0.5) * 0.8, 1, 0.8 + rand() * 1.2, 1, Math.PI / 2);
        }
        // statue bases a step further out, every so often
        if (rand() < 0.22) {
          const o2 = off + 2.2;
          place(pedestals, p.x + nx * o2 * side, y, p.z + nz * o2 * side, Math.atan2(p.dir[0], p.dir[1]), 1, 0.8 + rand() * 0.6, 1);
        }
      }
    }
  }
  // low rubble walls: what is left of the buildings that lined the square
  for (const side of [-1, 1]) {
    for (let z = -1; z < 30; z += 1.05) {
      if (rand() < 0.18) continue;
      const hgt = 1 + Math.floor((0.5 + 0.5 * Math.sin(z * 0.35 + side)) * 3 + rand() * 2);
      for (let k = 0; k < hgt; k++) {
        const x = side * (27.5 + (rand() - 0.5) * 0.15);
        place(blocks, x, heightAt(x, z) + 0.27 + k * 0.55, z, Math.PI / 2 + (rand() - 0.5) * 0.06, 1, 1, 1.1);
      }
    }
  }
  // loose blocks around the square, away from the line of sight to the façade
  for (let i = 0; i < 46; i++) {
    const x = (rand() < 0.5 ? -1 : 1) * (13 + rand() * 13), z = 6 + rand() * 30;
    const s = 0.5 + rand() * 0.9;
    place(blocks, x, heightAt(x, z) + 0.2 * s, z, rand() * 6, s * (1 + rand()), s, s * (0.8 + rand() * 0.6), (rand() - 0.5) * 0.2);
  }

  const add = (geo, list, shadow = true) => {
    if (!list.length) return;
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((x, i) => m.setMatrixAt(i, x));
    m.castShadow = shadow;
    m.receiveShadow = true;
    m.computeBoundingSphere();
    scene.add(m);
  };
  add(fullColumn(), full);
  add(mergeGeometries(base().map(strip)), bases);
  add(stumpShaft(3.7), shafts);
  add(strip(new RoundedBoxGeometry(1.1, 1.6, 1.1, 2, 0.04)).translate(0, 0.8, 0), pedestals);
  add(fluted(1, R, R, false, 0).translate(0, -0.5, 0), drums);
  add(strip(new RoundedBoxGeometry(1, 0.55, 0.8, 2, 0.06)), blocks);
}
