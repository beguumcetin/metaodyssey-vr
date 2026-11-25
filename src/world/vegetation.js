// Trees (procedural, instanced) and scanned shrubs, grass and rocks from Poly Haven (CC0).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { heightAt, STREETS, streetInfo, PLAZA } from './layout.js';
import { fbm, rng } from './noise.js';
import { patchMaterial } from './shaders.js';

const lin = (hex) => new THREE.Color(hex);   // THREE.Color(hex) converts sRGB hex to linear working space

function trunk(h, r0, r1, bend, color) {
  const g = new THREE.CylinderGeometry(r1, r0, h, 7, 6, true).toNonIndexed();
  g.translate(0, h / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / h;
    p.setX(i, p.getX(i) + Math.sin(t * Math.PI * 0.6) * bend);
  }
  g.computeVertexNormals();
  paint(g, () => color);
  return g;
}

// A lumpy blob of foliage. Normals point away from `center` so the crown shades as one soft volume.
function blob(r, scale, offset, center, base, rand) {
  const g = new THREE.IcosahedronGeometry(r, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i);
    const n = fbm(v.x * 1.7 + offset.x, v.y * 1.7 + offset.y + v.z, 3);
    v.multiplyScalar(0.78 + n * 0.45);
    v.multiply(scale).add(offset);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  const nrm = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i).sub(center).normalize();
    nrm.setXYZ(i, v.x, v.y * 1.2, v.z);
  }
  const low = offset.y - r * scale.y, span = 2 * r * scale.y, tint = 0.85 + rand() * 0.3;
  paint(g, (x, y) => {
    const ao = THREE.MathUtils.clamp(0.55 + 0.5 * (y - low) / span, 0.55, 1.05);
    return base.clone().multiplyScalar(ao * tint);
  });
  return g;
}

function paint(g, fn) {
  const p = g.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const col = fn(p.getX(i), p.getY(i), p.getZ(i));
    c.set([col.r, col.g, col.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
}

function stonePine(rand) {
  const h = 6.2, bark = lin(0x6a5040), green = lin(0x4f6e35);
  const parts = [trunk(h + 1, 0.36, 0.2, 0.7, bark)];
  const center = new THREE.Vector3(0.7, h + 1.2, 0);
  parts.push(blob(3.2, new THREE.Vector3(1.2, 0.62, 1.2), center.clone(), center, green, rand));
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rand() * 0.6;
    const d = 2.6 + rand() * 1.6;
    const off = new THREE.Vector3(Math.cos(a) * d + 0.7, h + 0.4 + rand() * 1.4, Math.sin(a) * d);
    parts.push(blob(1.6 + rand() * 0.8, new THREE.Vector3(1, 0.7, 1), off, center, green, rand));
  }
  return mergeGeometries(parts);
}

// Cheap tree for far slopes: a trunk and one lumpy crown.
function farTree(rand) {
  const parts = [trunk(4, 0.3, 0.2, 0.3, lin(0x5a4636))];
  const center = new THREE.Vector3(0, 5, 0);
  parts.push(blob(2.8, new THREE.Vector3(1.15, 0.75, 1.15), center.clone(), center, lin(0x46642f), rand));
  return mergeGeometries(parts);
}

function cypress(rand) {
  const bark = lin(0x4a3a2c), green = lin(0x52753d);
  const parts = [trunk(2, 0.22, 0.15, 0, bark)];
  const center = new THREE.Vector3(0, 6, 0);
  for (let i = 0; i < 6; i++) {
    const y = 1.6 + i * 1.75, r = 1.15 - i * 0.13;
    parts.push(blob(r, new THREE.Vector3(1, 1.6, 1), new THREE.Vector3((rand() - 0.5) * 0.2, y, (rand() - 0.5) * 0.2), center, green, rand));
  }
  return mergeGeometries(parts);
}

function olive(rand) {
  const bark = lin(0x5e5040), green = lin(0x75805a);
  const parts = [trunk(2.2, 0.28, 0.17, 0.35, bark)];
  const center = new THREE.Vector3(0.3, 3.2, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const off = new THREE.Vector3(Math.cos(a) * 1.3 + 0.3, 2.9 + rand() * 1.1, Math.sin(a) * 1.3);
    parts.push(blob(1.35, new THREE.Vector3(1, 0.75, 1), off, center, green, rand));
  }
  return mergeGeometries(parts);
}

function onPaving(x, z, margin) {
  if (x > PLAZA.minX - margin && x < PLAZA.maxX + margin && z > PLAZA.minZ - margin - 15 && z < PLAZA.maxZ + margin) return true;
  return STREETS.some((s) => streetInfo(s, x, z).dist < s.width / 2 + margin);
}

// Pick n spots with a density function; returns matrices standing on the ground.
function scatter(n, seed, area, accept, scaleRange, sink = 0.1) {
  const rand = rng(seed), out = [];
  let tries = 0;
  while (out.length < n && tries++ < n * 60) {
    const a = rand() * Math.PI * 2, r = area[0] + Math.sqrt(rand()) * (area[1] - area[0]);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!accept(x, z, rand)) continue;
    const s = scaleRange[0] + rand() * (scaleRange[1] - scaleRange[0]);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, heightAt(x, z) - sink, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler((rand() - 0.5) * 0.06, rand() * Math.PI * 2, (rand() - 0.5) * 0.06)),
      new THREE.Vector3(s, s * (0.9 + rand() * 0.2), s));
    out.push(m);
  }
  return out;
}

function instanced(geometry, material, matrices, shadow) {
  const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  return mesh;
}

function shuffle(list) {
  const rand = rng(99);
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function slope(x, z) {
  return Math.hypot(heightAt(x + 2, z) - heightAt(x - 2, z), heightAt(x, z + 2) - heightAt(x, z - 2)) / 4;
}

export function addTrees(scene) {
  const rand = rng(7);
  const foliage = (h) => patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }),
    { cloud: true, wind: { strength: 0.18, height: h }, key: 'tree' + h });

  const pines = scatter(1100, 11, [50, 650], (x, z, r) =>
    !onPaving(x, z, 10) && slope(x, z) < 1.0 && fbm(x * 0.012, z * 0.012) > 0.36 + r() * 0.12, [0.8, 1.4]);
  const cypresses = [
    ...scatter(14, 12, [30, 160], (x, z) => !onPaving(x, z, 7.5) && onPaving(x, z, 16), [0.85, 1.25]),
    ...scatter(25, 13, [60, 400], (x, z, r) => !onPaving(x, z, 8) && fbm(x * 0.03 + 5, z * 0.03) > 0.6, [0.9, 1.3]),
  ];
  const olives = scatter(140, 14, [30, 320], (x, z, r) =>
    !onPaving(x, z, 7.5) && heightAt(x, z) < 25 && fbm(x * 0.02 + 2, z * 0.02 + 8) > 0.45, [0.8, 1.3]);

  const dist = (m) => new THREE.Vector3().setFromMatrixPosition(m).length();
  const near = (list) => list.filter((m) => dist(m) < 70);
  const far = (list) => list.filter((m) => dist(m) >= 70);
  const forest = scatter(3000, 15, [90, 1300], (x, z, r) => !onPaving(x, z, 15) && slope(x, z) < 1.2 && fbm(x * 0.006 + 1, z * 0.006 - 3) > 0.4 + r() * 0.1, [0.8, 1.5], 0.4);
  // pines beyond 170 m use the cheap one-crown tree
  forest.push(...pines.filter((m) => dist(m) >= 170));
  pines.splice(0, pines.length, ...pines.filter((m) => dist(m) < 170));
  const kinds = [[stonePine(rand), pines, 10], [cypress(rand), cypresses, 11], [olive(rand), olives, 4.5], [farTree(rand), forest, 8]];
  for (const [geo, list, h] of kinds) {
    const mat = foliage(h);
    if (near(list).length) scene.add(instanced(geo, mat, near(list), true));
    if (far(list).length) {
      const m = instanced(geo, mat, shuffle(far(list)), false);
      m.userData.thinInVr = true;   // shuffled, so keeping the first part thins evenly
      scene.add(m);
    }
  }
}

// Load a Poly Haven model and instance every mesh in it at the given spots.
async function addInstancedModel(scene, loader, url, matrices, { wind = 0, height = 1, shadow = false } = {}) {
  const gltf = await loader.loadAsync(url);
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
    const mat = o.material;
    if (wind) mat.side = THREE.DoubleSide;
    patchMaterial(mat, { cloud: true, wind: wind ? { strength: wind, height } : null, key: url + o.name });
    const mesh = instanced(geo, mat, matrices, shadow);
    mesh.userData.thinInVr = !!wind;   // grass and shrubs: fewer of them in a headset
    scene.add(mesh);
  });
}

export async function addGroundCover(scene, loader) {
  const notPaved = (m) => (x, z) => !onPaving(x, z, m);
  const shrubSpots = scatter(110, 21, [18, 140], (x, z, r) => notPaved(3)(x, z) && fbm(x * 0.05, z * 0.05 + 3) > 0.42, [0.9, 1.6], 0.05);
  const half = Math.ceil(shrubSpots.length / 2);
  const grassSpots = scatter(420, 22, [12, 110], (x, z, r) => notPaved(1.2)(x, z) && fbm(x * 0.08 + 7, z * 0.08) > 0.38, [0.9, 1.8], 0.02);
  const rockSpots = scatter(45, 23, [16, 180], notPaved(2), [0.6, 1.6], 0.15);
  const boulderSpots = scatter(14, 24, [35, 220], notPaved(6), [2.2, 3.5], 0.6);
  await Promise.all([
    addInstancedModel(scene, loader, 'assets/models/shrub_02.glb', shrubSpots.slice(0, half), { wind: 0.05, height: 1.2, shadow: true }),
    addInstancedModel(scene, loader, 'assets/models/shrub_04.glb', shrubSpots.slice(half), { wind: 0.05, height: 1.2, shadow: true }),
    addInstancedModel(scene, loader, 'assets/models/grass_medium_02.glb', grassSpots, { wind: 0.08, height: 0.6 }),
    addInstancedModel(scene, loader, 'assets/models/rock_07.glb', rockSpots, { shadow: true }),
    addInstancedModel(scene, loader, 'assets/models/rock_07.glb', boulderSpots, { shadow: true }),
  ]);
}
