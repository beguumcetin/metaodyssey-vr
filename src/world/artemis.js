// Sardis around AD 150: the Temple of Artemis below the acropolis, its old Lydian altar, a smoking offering,
// the Pactolus stream that once carried gold, and houses on the slopes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fluted, strip } from './ruins.js';
import { box, entablature, extrude, triangle, wallBlocks, doorFrame, makeMaterials, newParts, buildMeshes, statue } from './celsus.js';
import { heightAt } from './layout.js';
import { rng } from './noise.js';
import { patchMaterial, uTime } from './shaders.js';

export const TEMPLE = { halfW: 21.2, front: 0, back: -98, top: 1.6 };   // stylobate edges (m) and height
const STEP = 0.4;
const COL_H = 17.8;

export const riverX = (z) => -52 + Math.sin(z * 0.011) * 9 + Math.sin(z * 0.004 + 1) * 6;

// Asiatic Ionic column: square plinth, torus and scotia, 24 flutes, a capital with spiral volutes.
function ionicColumn() {
  const r = 0.98;
  const parts = [
    box(-1.25, 1.25, 0, 0.35, -1.25, 1.25),
    strip(new THREE.CylinderGeometry(r * 1.2, r * 1.28, 0.32, 40).translate(0, 0.51, 0)),
    strip(new THREE.CylinderGeometry(r * 1.08, r * 1.12, 0.22, 40).translate(0, 0.78, 0)),
    strip(new THREE.TorusGeometry(r * 1.12, 0.12, 8, 40).rotateX(Math.PI / 2).translate(0, 0.92, 0)),
  ];
  const shaftH = COL_H - 1.0 - 0.95;
  parts.push(strip(fluted(shaftH, r, r * 0.86, false, 0)).translate(0, 1.0, 0));
  const y = 1.0 + shaftH;
  parts.push(strip(new THREE.CylinderGeometry(r * 1.05, r * 0.88, 0.32, 40).translate(0, y + 0.16, 0)));   // echinus
  for (const sx of [-1, 1]) {
    // the cushion runs front to back; its round ends are the volutes seen from the front
    parts.push(strip(new THREE.CylinderGeometry(0.46, 0.46, 1.9, 28).rotateX(Math.PI / 2).translate(sx * 0.98, y + 0.42, 0)));
    for (const sz of [-1, 1]) {
      for (const [rad, tube] of [[0.32, 0.06], [0.17, 0.05]]) {
        parts.push(strip(new THREE.TorusGeometry(rad, tube, 6, 24).translate(sx * 0.98, y + 0.42, sz * 0.96)));
      }
    }
  }
  parts.push(box(-0.98, 0.98, y + 0.5, y + 0.88, -0.92, 0.92));       // canalis between the volutes
  parts.push(box(-1.22, 1.22, y + 0.82, y + 0.95, -1.22, 1.22));      // abacus
  return mergeGeometries(parts);
}

function columnPositions() {
  const { halfW } = TEMPLE;
  const xs = [-19.9, -14.2, -8.5, -3.1, 3.1, 8.5, 14.2, 19.9];
  const zFront = [-2.6, -8.2], zBack = [-95.4, -89.8];
  const pos = [];
  for (const z of [...zFront, ...zBack]) for (const x of xs) pos.push([x, z]);
  // flanks: one row of 20 along each side (corners already counted)
  for (let i = 1; i < 19; i++) {
    const z = -2.6 - (i * (95.4 - 2.6)) / 19;
    if (z < -8.5 && z > -89.5) for (const x of [-halfW + 1.3, halfW - 1.3]) pos.push([x, z]);
  }
  // porch columns in front of the cella door
  for (const x of [-6.5, 6.5]) pos.push([x, -13.5]);
  return pos;
}

function waterMesh() {
  const pts = [], uvs = [], idx = [];
  const W = 4.2, n = 220;
  for (let i = 0; i <= n; i++) {
    const z = -500 + (i / n) * 1100, cx = riverX(z);
    for (const k of [-1, 1]) { pts.push(cx + k * W, -1.45, z); uvs.push(k * 0.5 + 0.5, z / 12); }
  }
  for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0x2f4a4f, roughness: 0.08, metalness: 0.2, envMapIntensity: 1.4 });
  patchMaterial(mat, {
    key: 'river', extra: (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
  {
    vec2 p = vWorld.xz * vec2(0.18, 0.05) + vec2(0.0, -uTime * 0.09);
    float r = texture2D(uNoise, p).r * 0.6 + texture2D(uNoise, p * 2.3 + 0.4).r * 0.4;
    gl_FragColor.rgb += vec3(0.2, 0.19, 0.14) * smoothstep(0.6, 0.8, r);   // glints on the ripples
    gl_FragColor.rgb *= 0.8 + 0.3 * r;
  }`);
    },
  });
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  return m;
}

// Smoke rising from the offering on the altar: soft sprites that drift up, widen and fade.
function addSmoke(group, x, y, z) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.55)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const N = 36;
  const geo = new THREE.BufferGeometry();
  const seeds = new Float32Array(N);
  for (let i = 0; i < N; i++) seeds[i] = i / N;
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime, uMap: { value: tex }, uBase: { value: new THREE.Vector3(x, y, z) } },
    vertexShader: `
      uniform float uTime; uniform vec3 uBase; attribute float seed; varying float vLife;
      void main() {
        float life = fract(uTime * 0.07 + seed);
        vLife = life;
        vec3 p = uBase + vec3(sin(seed * 40.0 + uTime * 0.3) * 0.4 * life + life * life * 4.0, life * 11.0, cos(seed * 23.0) * 0.4 * life);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (90.0 + 520.0 * life) / -mv.z;
      }`,
    fragmentShader: `
      uniform sampler2D uMap; varying float vLife;
      void main() {
        float a = texture2D(uMap, gl_PointCoord).a * smoothstep(0.0, 0.12, vLife) * (1.0 - vLife) * 0.55;
        gl_FragColor = vec4(vec3(0.86, 0.84, 0.8) * (1.0 - 0.25 * vLife), a);
      }`,
    transparent: true, depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  group.add(pts);
  // the fire itself: a few flickering flames
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.0, 10).translate(0, 0.5, 0),
    new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85, toneMapped: false }));
  flame.position.set(x, y - 0.2, z);
  group.add(flame);
  return (t) => { flame.scale.set(1 + Math.sin(t * 13) * 0.12, 0.85 + Math.sin(t * 9.3) * 0.25 + Math.sin(t * 17) * 0.1, 1); };
}

// Simple town houses: plastered walls and tiled roofs, set on the slopes around the sanctuary.
function addHouses(group, mats, avoid) {
  const rand = rng(91);
  const walls = [], roofs = [];
  const m4 = (x, y, z, ry, sx, sy, sz) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz));
  let placed = 0;
  for (let k = 0; k < 2000 && placed < 140; k++) {
    const a = rand() * Math.PI * 2, d = 55 + rand() * 210;
    const x = Math.cos(a) * d, z = Math.sin(a) * d + 40;
    if (avoid(x, z)) continue;
    // keep to gentle ground
    const h = heightAt(x, z), hx = heightAt(x + 4, z), hz = heightAt(x, z + 4);
    if (Math.abs(hx - h) > 1.6 || Math.abs(hz - h) > 1.6) continue;
    const w = 5 + rand() * 6, dpt = 5 + rand() * 7, hgt = 3.2 + (rand() < 0.3 ? 2.8 : 0);
    const ry = Math.round(rand() * 4) * (Math.PI / 2) + (rand() - 0.5) * 0.2;
    walls.push(m4(x, h - 0.6, z, ry, w, hgt + 0.6, dpt));
    roofs.push(m4(x, h + hgt, z, ry, w + 0.6, 1.4, dpt + 0.6));
    placed++;
  }
  const wallGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const prism = new THREE.Shape();
  prism.moveTo(-0.5, 0); prism.lineTo(0.5, 0); prism.lineTo(0, 1); prism.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(prism, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5);
  for (const [geo, mat, list] of [[wallGeo, mats.side, walls], [roofGeo, mats.roof, roofs]]) {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((x, i) => im.setMatrixAt(i, x));
    im.castShadow = true; im.receiveShadow = true;
    im.computeBoundingSphere();
    group.add(im);
  }
}

export function addSardis(scene, manager) {
  const mats = makeMaterials(manager);
  const out = newParts();
  const group = new THREE.Group();
  group.name = 'sardis';
  const { halfW, front, back, top } = TEMPLE;

  // ---- stepped platform (crepidoma) ----
  for (let k = 0; k < 4; k++) {
    const o = (3 - k) * 0.55;
    out.marble.push(box(-halfW - o, halfW + o, -0.6, (k + 1) * STEP, back - o, front + o));
  }

  // ---- columns ----
  const col = ionicColumn();
  const cols = columnPositions();
  const im = new THREE.InstancedMesh(col, mats.marble, cols.length);
  cols.forEach(([x, z], i) => im.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, top, z)));
  im.castShadow = true; im.receiveShadow = true;
  im.computeBoundingSphere();
  group.add(im);

  // ---- cella: long walls, a door in the front wall, a dark interior ----
  const cx = 11.5, cz0 = -16, cz1 = -84, cH = top + COL_H;
  out.wall.push(box(-cx, -cx + 1.2, top, cH, cz1, cz0), box(cx - 1.2, cx, top, cH, cz1, cz0), box(-cx, cx, top, cH, cz1, cz1 + 1.2));
  const door = [-3.2, 3.2, top, top + 11];
  for (const b of wallBlocks([door], -cx, cx, top, cH)) out.wall.push(box(b[0], b[1], b[2], b[3], cz0 - 1.2, cz0));
  doorFrame(out, ...door);
  out.gold.push(box(door[0], door[1], top, top + 0.05, cz0 - 0.4, cz0 + 0.02));
  const hall = new THREE.Mesh(new THREE.BoxGeometry(2 * cx - 2.6, COL_H - 0.3, cz0 - cz1 - 2.6).translate(0, top + (COL_H - 0.3) / 2, (cz0 + cz1) / 2),
    new THREE.MeshBasicMaterial({ color: 0x2b1f16, side: THREE.BackSide }));
  group.add(hall);
  // the goddess inside, glimpsed through the door
  const goddess = statue(0xc9a14a, 2.1);
  goddess.scale.setScalar(3.4);
  goddess.position.set(0, top + 1.2, -60);
  out.marble.push(box(-1.6, 1.6, top, top + 1.2, -61.6, -58.4));
  group.add(goddess);

  // ---- entablature over the whole peristyle, then the gabled roof ----
  const eY = top + COL_H;
  const eTop = entablature(out, -halfW + 0.1, halfW - 0.1, back + 0.4, front - 0.4, eY, 1.7, true);
  const pedH = 6.2;
  for (const [z0, z1] of [[front - 1.6, front - 0.3], [back + 0.3, back + 1.6]]) {
    const frame = triangle(2 * halfW + 0.4, pedH);
    frame.holes.push(new THREE.Path(triangle(2 * halfW - 2.6, pedH - 1.2).getPoints().map((p) => p.add(new THREE.Vector2(0, 0.45)))));
    out.marble.push(extrude(frame, z0, z1 + 0.15).translate(0, eTop, 0));
    out.tympanum.push(extrude(triangle(2 * halfW, pedH), z0 - 0.3, z1 - 0.25).translate(0, eTop, 0));
  }
  // the roof stops behind the pediments so their painted fields stay visible
  out.roof.push(extrude(triangle(2 * halfW + 1.2, pedH + 0.25), back + 1.7, front - 1.7).translate(0, eTop, 0));
  // gilded acroteria on the gables
  for (const z of [front - 0.6, back + 0.6]) {
    out.gold.push(strip(new THREE.ConeGeometry(0.7, 2.2, 12).translate(0, eTop + pedH + 1.1, z)));
    for (const sx of [-1, 1]) out.gold.push(strip(new THREE.SphereGeometry(0.6, 12, 8).translate(sx * (halfW - 0.2), eTop + 0.7, z)));
  }

  // ---- the Lydian altar in front of the temple, older than the temple itself ----
  const ax0 = -10.5, ax1 = 10.5, az0 = 16, az1 = 27, aH = 2.6;
  out.side.push(box(ax0, ax1, -0.4, aH, az0, az1));
  for (let k = 0; k < 6; k++) out.marble.push(box(-4.5, 4.5, -0.4, aH - k * 0.43, az1, az1 + (k + 1) * 0.42));
  out.marble.push(box(ax0 - 0.2, ax1 + 0.2, aH, aH + 0.25, az0 - 0.2, az1 + 0.2));
  out.marble.push(box(-1.6, 1.6, aH + 0.25, aH + 1.15, 20, 23));   // the offering table
  const smoke = addSmoke(group, 0, aH + 1.35, 21.5);

  buildMeshes(out, mats, group);
  group.add(waterMesh());
  addHouses(group, mats, (x, z) =>
    (x > -45 && x < 45 && z > -120 && z < 45) || Math.abs(x - riverX(z)) < 16 || Math.abs(x - (z > 36 ? -0.07 * (z - 36) : 0)) < 12);

  // the platform and altar are walkable in VR
  group.userData.walkable = group.children.find((c) => c.isMesh && c.material === mats.marble);
  scene.add(group);
  return { group, animators: [smoke] };
}

// Standing height on the temple platform, altar stairs or the ground.
export function sardisGround(x, z) {
  const { halfW, front, back, top } = TEMPLE;
  for (let k = 3; k >= 0; k--) {
    const o = (3 - k) * 0.55;
    if (x > -halfW - o && x < halfW + o && z > back - o && z < front + o) return (k + 1) * STEP;
  }
  return Math.max(heightAt(x, z), 0);
}
