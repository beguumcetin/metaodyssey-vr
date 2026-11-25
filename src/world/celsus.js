// The Library of Celsus as it stood around AD 120, modelled in code so it shares the world's light and style.
// The façade faces +z and is centred on x = 0; the podium front is the top of nine steps.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fluted, base, strip } from './ruins.js';
import { patchMaterial } from './shaders.js';

const Y0 = 1.53;          // podium top (9 steps of 17 cm)
const W = 10.6;           // half the façade width
const LOWER = [-7.8, -2.6, 2.6, 7.8];   // centres of the four lower column pairs
const UPPER = [-5.2, 0, 5.2];           // upper pairs stand over the gaps (the famous offset)
const COL_Z = 1.45;
const HALL_BACK = -13;

export const box = (x0, x1, y0, y1, z0, z1) =>
  strip(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));

// Planar UVs from world position, so the marble grain has the same scale on every block.
export function worldUV(g, size) {
  const p = g.attributes.position, n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ax >= ay && ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else if (ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u / size; uv[i * 2 + 1] = v / size;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// Frieze UVs: u runs along the band, v from its bottom to its top.
function friezeUV(g, y0, h, period) {
  const p = g.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) + p.getZ(i)) / period; uv[i * 2 + 1] = (p.getY(i) - y0) / h; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

function corinthian() {
  const parts = [strip(new THREE.CylinderGeometry(0.5, 0.35, 0.62, 32).translate(0, 0.31, 0))];
  for (let row = 0; row < 2; row++) {
    for (let k = 0; k < 8; k++) {
      const a = ((k + row * 0.5) / 8) * Math.PI * 2;
      const r = row ? 0.45 : 0.39, y = row ? 0.38 : 0.17;
      const leaf = new THREE.SphereGeometry(0.12, 8, 6).scale(1, row ? 1.9 : 1.5, 0.5)
        .rotateX(0.35).rotateY(Math.PI / 2 - a).translate(Math.cos(a) * r, y, Math.sin(a) * r);
      parts.push(strip(leaf));
    }
  }
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    parts.push(strip(new THREE.TorusGeometry(0.08, 0.035, 6, 14).rotateY(Math.PI / 4 * sx * sz).translate(sx * 0.47, 0.58, sz * 0.47)));
  }
  parts.push(box(-0.58, 0.58, 0.62, 0.76, -0.58, 0.58));
  return mergeGeometries(parts);
}

function column(x, y, z, s, shaft) {
  const g = mergeGeometries([
    ...base().map(strip),
    strip(fluted(shaft / s, 0.38, 0.33, false, 0)).translate(0, 0.54, 0),
    corinthian().translate(0, 0.54 + shaft / s, 0),
  ]);
  return g.scale(s, s, s).translate(x, y, z);
}
const columnHeight = (s, shaft) => (0.54 + 0.76) * s + shaft;

// Architrave, frieze, dentils and cornice. Returns the height of its top.
export function entablature(out, x0, x1, z0, z1, y, s, sides) {
  const o = 0.035 * s;
  for (let k = 0; k < 3; k++) out.marble.push(box(x0 - (sides ? k * o : 0), x1 + (sides ? k * o : 0), y + k * 0.18 * s, y + (k + 1) * 0.18 * s, z0, z1 + k * o));
  const fy = y + 0.55 * s, fh = 0.45 * s;
  out.frieze.push(friezeUV(box(x0, x1, fy, fy + fh, z0, z1 - 0.02), fy, fh, 1.6 * s));
  out.marble.push(box(x0 - (sides ? 0.06 : 0), x1 + (sides ? 0.06 : 0), fy + fh, fy + fh + 0.08 * s, z0, z1 + 0.06));
  const dy = fy + fh + 0.08 * s, dh = 0.14 * s, step = 0.22 * s;
  for (let x = x0 + step / 2; x < x1; x += step) out.marble.push(box(x - 0.055 * s, x + 0.055 * s, dy, dy + dh, z1, z1 + 0.13 * s));
  if (sides) for (const sx of [x0, x1]) for (let z = z1 - step / 2; z > z0 + 0.1; z -= step) {
    const d = sx === x0 ? -1 : 1;
    out.marble.push(box(Math.min(sx, sx + d * 0.13 * s), Math.max(sx, sx + d * 0.13 * s), dy, dy + dh, z - 0.055 * s, z + 0.055 * s));
  }
  const cy = dy + dh;
  const ov = sides ? 0.24 * s : 0;
  out.marble.push(box(x0 - ov, x1 + ov, cy, cy + 0.2 * s, z0, z1 + 0.24 * s));
  out.paint.push(box(x0 - ov - 0.02, x1 + ov + 0.02, cy + 0.2 * s, cy + 0.24 * s, z0, z1 + 0.26 * s));
  return cy + 0.24 * s;
}

export function triangle(w, h) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
  return s;
}

export function segment(w, h) {
  const R = (w * w / 4 + h * h) / (2 * h), cy = h - R, a = Math.atan2(-cy, w / 2);
  const s = new THREE.Shape();
  s.moveTo(w / 2, 0); s.absarc(0, cy, R, a, Math.PI - a, false); s.closePath();
  return s;
}

export function extrude(shape, z0, z1) {
  return strip(new THREE.ExtrudeGeometry(shape, { depth: z1 - z0, bevelEnabled: false, curveSegments: 28 }).translate(0, 0, z0));
}

export function pediment(out, cx, y, w, curved, z0, z1) {
  const h = curved ? 1.35 : 1.25;
  const outer = curved ? segment(w, h) : triangle(w, h);
  const inner = curved ? segment(w - 0.7, h - 0.32) : triangle(w - 0.9, h - 0.4);
  const frame = curved ? segment(w, h) : triangle(w, h);
  frame.holes.push(new THREE.Path(inner.getPoints(28).map((p) => p.clone().add(new THREE.Vector2(0, 0.14)))));
  out.marble.push(extrude(frame, z0, z1 + 0.12).translate(cx, y, 0));
  out.tympanum.push(extrude(outer, z0, z1 - 0.18).translate(cx, y, 0));
  // gilded ornaments on the apex and corners
  out.gold.push(strip(new THREE.ConeGeometry(0.18, 0.55, 12).translate(cx, y + h + 0.25, (z0 + z1) / 2)));
  for (const sx of [-1, 1]) out.gold.push(strip(new THREE.SphereGeometry(0.16, 12, 8).translate(cx + sx * (w / 2 - 0.1), y + 0.18, z1 - 0.1)));
}

// Cover a rectangle with boxes, leaving the given openings [x0, x1, y0, y1] empty.
// (A single shape with many holes triangulates badly, so the wall is built from blocks.)
export function wallBlocks(openings, x0, x1, y0, y1) {
  const xs = [...new Set([x0, x1, ...openings.flatMap((o) => [o[0], o[1]])])].sort((a, b) => a - b);
  const blocks = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], b = xs[i + 1], mid = (a + b) / 2;
    const cuts = openings.filter((o) => o[0] < mid && o[1] > mid).map((o) => [o[2], o[3]]).sort((p, q) => p[0] - q[0]);
    let y = y0;
    for (const [c0, c1] of cuts) { if (c0 > y) blocks.push([a, b, y, c0]); y = Math.max(y, c1); }
    if (y < y1) blocks.push([a, b, y, y1]);
  }
  return blocks;
}

// Fills the two upper corners of a rectangular opening outside a half circle, making it an arch.
export function archFill(cx, hw, springY, z0, z1) {
  const top = hw + 0.15;
  const fill = new THREE.Shape();
  fill.moveTo(-hw, 0); fill.lineTo(-hw, top); fill.lineTo(hw, top); fill.lineTo(hw, 0); fill.absarc(0, 0, hw, 0, Math.PI, false);
  return extrude(fill, z0, z1).translate(cx, springY, 0);
}

function inscriptionTexture() {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#e9e1d2'; x.fillRect(0, 0, 2048, 256);
  x.fillStyle = '#b88a35';
  x.font = '600 52px "Times New Roman", serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  // the dedication to Augustus and his family, in bronze letters (Latin line of the bilingual text)
  x.fillText('IMP · CAESARI · DIVI · F · AVGVSTO · PONTIFICI · MAXIMO · COS · XII · TRIBVNIC · POTEST · XX', 1024, 84);
  x.fillText('ET · LIVIAE · CAESARIS · AVGVSTI · MAZAEVS · ET · MITHRIDATES · PATRONIS', 1024, 176);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// The Gate of Mazaeus and Mithridates (3 BC), three arches into the commercial agora, right of the library.
function addGate(out, group) {
  const X0 = 11.2, X1 = 20.2, Z0 = 0.8, Z1 = 3.2, H = 6.0;
  const arches = [[12.7, 0.95, 3.3], [15.7, 1.5, 3.9], [18.7, 0.95, 3.3]];   // centre, half width, springing height
  out.marble.push(box(X0 - 0.15, X1 + 0.15, 0, 0.3, Z0 - 0.15, Z1 + 0.2));
  const holes = arches.map(([cx, hw, sy]) => [cx - hw, cx + hw, -1, sy + hw + 0.15]);
  for (const b of wallBlocks(holes, X0, X1, 0.3, H)) out.wall.push(worldUV(box(b[0], b[1], b[2], b[3], Z0, Z1), 3));
  for (const [cx, hw, sy] of arches) {
    out.wall.push(worldUV(archFill(cx, hw, sy, Z0, Z1), 3));
    // moulded archivolt around each arch
    const ring = new THREE.Shape();
    ring.absarc(0, 0, hw + 0.22, 0, Math.PI, false); ring.lineTo(-hw, 0); ring.absarc(0, 0, hw, Math.PI, 0, true); ring.closePath();
    out.marble.push(extrude(ring, Z1, Z1 + 0.08).translate(cx, sy, 0));
    out.gold.push(box(cx - 0.12, cx + 0.12, sy + hw - 0.05, sy + hw + 0.25, Z1 + 0.02, Z1 + 0.14));   // keystone
  }
  // half columns on the piers
  for (const x of [11.47, 13.92, 17.47, 19.92]) out.marble.push(column(x, 0.3, Z1 + 0.05, 0.62, H - 0.3 - 1.3 * 0.62));
  const top = entablature(out, X0, X1, Z0, Z1 + 0.35, H, 0.8, true);
  // the attic that carries the dedication
  out.marble.push(box(X0 + 0.1, X1 - 0.1, top, top + 1.35, Z0 + 0.1, Z1 + 0.2), box(X0, X1, top + 1.35, top + 1.55, Z0, Z1 + 0.32));
  const text = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0 - 0.6, 1.1), new THREE.MeshStandardMaterial({ map: inscriptionTexture(), roughness: 0.55 }));
  text.position.set((X0 + X1) / 2, top + 0.68, Z1 + 0.21);
  text.receiveShadow = true;
  group.add(text);
}

export function doorFrame(out, x0, x1, y0, y1) {
  const t = 0.2;
  out.marble.push(box(x0 - t, x0, y0, y1 + t, -0.02, 0.1), box(x1, x1 + t, y0, y1 + t, -0.02, 0.1), box(x0 - t - 0.1, x1 + t + 0.1, y1, y1 + 0.26, -0.02, 0.16));
}

// A draped figure in the old painted manner. Each virtue gets its own robe colour.
export function statue(robeColor, seed) {
  const pts = [[0, 0], [0.33, 0], [0.35, 0.06], [0.32, 0.35], [0.3, 0.8], [0.27, 1.18], [0.24, 1.42], [0.29, 1.6], [0.26, 1.74], [0.16, 1.84], [0.06, 1.88], [0.055, 1.97], [0, 1.97]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const robe = new THREE.LatheGeometry(pts, 40);
  const p = robe.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z);
    if (r < 1e-3 || y < 0.04 || y > 1.7) continue;
    const a = Math.atan2(z, x);
    const k = 1 + 0.06 * Math.sin(a * 11 + y * 1.5 + seed) * Math.min(1, (1.7 - y) * 2);
    p.setXYZ(i, x * k, y, z * k);
  }
  robe.computeVertexNormals();
  // a mantle wrapped over one shoulder
  const mantle = new THREE.TorusGeometry(0.27, 0.07, 8, 28, Math.PI * 1.3).rotateX(Math.PI / 2).rotateZ(0.5).translate(0, 1.32, 0.02);
  const arm = new THREE.CapsuleGeometry(0.05, 0.42, 4, 8).rotateX(-1.1).translate(0.2, 1.38, 0.2);
  const head = new THREE.SphereGeometry(0.115, 20, 14).scale(1, 1.15, 1.05).translate(0, 2.07, 0.01);
  const hair = new THREE.SphereGeometry(0.125, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62).scale(1.02, 1.1, 1.05).translate(0, 2.1, -0.025);
  const scroll = new THREE.CylinderGeometry(0.035, 0.035, 0.26, 10).rotateZ(Math.PI / 2).translate(0.22, 1.42, 0.42);
  const robeMat = new THREE.MeshStandardMaterial({ color: robeColor, roughness: 0.75 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xeadbc6, roughness: 0.55 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xc9a14a, roughness: 0.35, metalness: 0.6 });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(robe, robeMat), new THREE.Mesh(mantle, robeMat.clone()), new THREE.Mesh(mergeGeometries([strip(head), strip(arm)]), skinMat),
    new THREE.Mesh(hair, new THREE.MeshStandardMaterial({ color: 0x4a3324, roughness: 0.8 })), new THREE.Mesh(scroll, goldMat));
  g.children[1].material.color.offsetHSL(0, -0.1, 0.12);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function friezeTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#8f3d2b'; x.fillRect(0, 0, 512, 128);
  x.strokeStyle = '#d9b25c'; x.fillStyle = '#d9b25c'; x.lineWidth = 7; x.lineCap = 'round';
  // a running vine scroll with spirals, the classic Roman frieze motif
  x.beginPath();
  for (let i = 0; i <= 512; i += 4) { const y = 64 + Math.sin((i / 512) * Math.PI * 4) * 26; i ? x.lineTo(i, y) : x.moveTo(i, y); }
  x.stroke();
  for (let k = 0; k < 4; k++) {
    const cx = 64 + k * 128, up = k % 2 ? 1 : -1, cy = 64 + up * 30;
    x.beginPath();
    for (let a = 0; a < Math.PI * 3.2; a += 0.1) { const r = 22 - a * 2.1; x.lineTo(cx + Math.cos(a * up) * r, cy + Math.sin(a * up) * r * 0.9); }
    x.lineWidth = 5; x.stroke();
    x.beginPath(); x.ellipse(cx + 40, 64 - up * 14, 12, 6, 0.6 * up, 0, Math.PI * 2); x.fill();
  }
  x.fillStyle = '#e8d6ae'; x.fillRect(0, 0, 512, 7); x.fillRect(0, 121, 512, 7);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// Faint ashlar joints: horizontal courses with staggered vertical joints.
export const JOINTS = (course, length) => (sh) => {
  sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
  {
    float row = floor(vWorld.y / ${course.toFixed(2)});
    float h = fract(vWorld.y / ${course.toFixed(2)});
    float v = fract((vWorld.x + vWorld.z + row * ${(length / 2).toFixed(2)}) / ${length.toFixed(2)});
    float j = max(1.0 - smoothstep(0.0, 0.025, min(h, 1.0 - h)), 1.0 - smoothstep(0.0, 0.012, min(v, 1.0 - v)));
    gl_FragColor.rgb *= 1.0 - 0.22 * j;
  }`);
};

// Shared materials for modelled monuments (Celsus, the gate, the temples of Sardis and Aigai).
export function makeMaterials(manager) {
  const loader = new THREE.TextureLoader(manager);
  const marbleMap = loader.load('assets/tex/marble_01_diff.jpg');
  marbleMap.colorSpace = THREE.SRGBColorSpace;
  marbleMap.wrapS = marbleMap.wrapT = THREE.RepeatWrapping;

  const mats = {
    marble: patchMaterial(new THREE.MeshStandardMaterial({ map: marbleMap, color: 0xf6f0e6, roughness: 0.5 }), { cloud: true, key: 'celsus-marble' }),
    wall: patchMaterial(new THREE.MeshStandardMaterial({ map: marbleMap, color: 0xeee4d3, roughness: 0.6 }), { cloud: true, key: 'celsus-wall', extra: JOINTS(0.62, 1.5) }),
    frieze: patchMaterial(new THREE.MeshStandardMaterial({ map: friezeTexture(), roughness: 0.7 }), { cloud: true, key: 'celsus-frieze' }),
    paint: patchMaterial(new THREE.MeshStandardMaterial({ color: 0x9a4430, roughness: 0.7 }), { cloud: true, key: 'celsus-paint' }),
    tympanum: patchMaterial(new THREE.MeshStandardMaterial({ color: 0x35587e, roughness: 0.75 }), { cloud: true, key: 'celsus-blue' }),
    niche: new THREE.MeshStandardMaterial({ color: 0x2f4d70, roughness: 0.85 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xc9a14a, roughness: 0.35, metalness: 0.6 }),
    side: patchMaterial(new THREE.MeshStandardMaterial({ color: 0xbda281, roughness: 0.92 }), { cloud: true, key: 'celsus-side', extra: JOINTS(0.55, 1.2) }),
    roof: patchMaterial(new THREE.MeshStandardMaterial({ color: 0x9c553a, roughness: 0.85 }), { cloud: true, key: 'celsus-roof', extra: (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
  { float r = fract(vWorld.x / 0.42); gl_FragColor.rgb *= 0.82 + 0.18 * smoothstep(0.0, 0.5, r) * smoothstep(1.0, 0.6, r); }`);
    } }),
    interior: new THREE.MeshBasicMaterial({ color: 0x2b1f16, side: THREE.BackSide }),   // unlit: a dim hall seen from the sunny square
  };
  return mats;
}

export const newParts = () => ({ marble: [], wall: [], frieze: [], paint: [], tympanum: [], niche: [], gold: [], side: [], roof: [] });

// Merge every list of parts into one mesh per material.
export function buildMeshes(out, mats, group) {
  for (const [k, list] of Object.entries(out)) {
    if (!list.length) continue;
    const geo = mergeGeometries(list.map((g) => (k === 'marble' || k === 'side' ? worldUV(g, 3) : g)));
    const m = new THREE.Mesh(geo, mats[k]);
    m.castShadow = k !== 'niche';
    m.receiveShadow = true;
    group.add(m);
  }
}

export function addCelsus(scene, manager) {
  const mats = makeMaterials(manager);
  const out = newParts();

  // ---- steps and podium ----
  for (let k = 0; k < 9; k++) {
    const top = Y0 - k * 0.17;
    out.marble.push(box(-W - 0.4, W + 0.4, -0.05, top, -0.6, 2.4 + (k + 1) * 0.32));
  }

  // ---- lower storey: pedestals, paired columns, wall pilasters ----
  const colTop1 = Y0 + 1.0 + columnHeight(1, 5.3);
  for (const cx of LOWER) {
    out.marble.push(box(cx - 1.55, cx + 1.55, Y0, Y0 + 0.12, -0.1, 2.25), box(cx - 1.45, cx + 1.45, Y0 + 0.12, Y0 + 0.86, 0, 2.15),
      box(cx - 1.55, cx + 1.55, Y0 + 0.86, Y0 + 1.0, -0.1, 2.25));
    for (const d of [-0.95, 0.95]) {
      out.marble.push(column(cx + d, Y0 + 1.0, COL_Z, 1, 5.3));
      out.marble.push(box(cx + d - 0.3, cx + d + 0.3, Y0 + 1.0, colTop1, 0, 0.12));
    }
  }
  const yU = colTop1;
  // continuous entablature along the wall, plus a projecting block over every pair
  const Y1 = entablature(out, -W, W, -0.6, 0.4, yU, 1, false);
  for (const cx of LOWER) entablature(out, cx - 1.62, cx + 1.62, -0.6, 2.05, yU + 0.004, 1, true);

  // ---- upper storey ----
  out.marble.push(box(-W, W, Y1, Y1 + 0.65, -0.6, 0.25));
  const s2 = 0.8, colTop2 = Y1 + 0.65 + columnHeight(s2, 3.7);
  for (const cx of UPPER) {
    for (const d of [-1.6, 1.6]) {
      out.marble.push(box(cx + d - 0.45, cx + d + 0.45, Y1, Y1 + 0.65, 0.95, 1.95));
      out.marble.push(column(cx + d, Y1 + 0.65, COL_Z, s2, 3.7));
      out.marble.push(box(cx + d - 0.24, cx + d + 0.24, Y1 + 0.65, colTop2, 0, 0.1));
    }
  }
  const Y2 = entablature(out, -W, W, -0.6, 0.35, colTop2, s2, false);
  UPPER.forEach((cx, i) => {
    const top = entablature(out, cx - 2.15, cx + 2.15, -0.6, 1.95, colTop2 + 0.004, s2, true);
    pediment(out, cx, top, 4.9, i === 1, -0.3, 2.0);
  });

  // ---- the wall itself, with doors, windows and statue niches left open ----
  const openings = [
    [-1.2, 1.2, Y0, Y0 + 5.0], [-6.1, -4.3, Y0, Y0 + 4.0], [4.3, 6.1, Y0, Y0 + 4.0],          // doors
    [-1.0, 1.0, Y0 + 5.7, Y0 + 7.2], [-5.9, -4.5, Y0 + 4.8, Y0 + 6.2], [4.5, 5.9, Y0 + 4.8, Y0 + 6.2],   // lower windows
    ...UPPER.map((cx) => [cx - 1.0, cx + 1.0, Y1 + 0.95, Y1 + 4.3]),                           // upper windows
  ];
  for (const o of openings) doorFrame(out, ...o);
  const NICHE_HW = 0.62, nicheTop = Y0 + 4.3;
  const niches = LOWER.map((cx) => [cx - NICHE_HW, cx + NICHE_HW, Y0 + 1.0, nicheTop + NICHE_HW + 0.15]);
  for (const b of wallBlocks([...openings, ...niches], -W, W, Y0 - 0.5, Y2)) out.wall.push(worldUV(box(b[0], b[1], b[2], b[3], -0.6, 0), 3));
  for (const cx of LOWER) {
    out.niche.push(box(cx - 0.64, cx + 0.64, Y0 + 1.0, Y0 + 5.2, -0.62, -0.44));
    // round the top of each niche: fill its upper corners outside a half circle
    const hw = NICHE_HW, top = hw + 0.15;
    const fill = new THREE.Shape();
    fill.moveTo(-hw, 0); fill.lineTo(-hw, top); fill.lineTo(hw, top); fill.lineTo(hw, 0); fill.absarc(0, 0, hw, 0, Math.PI, false);
    out.wall.push(worldUV(extrude(fill, -0.6, 0).translate(cx, nicheTop, 0), 3));
  }

  // ---- the reading hall behind: side walls, back wall and a tiled roof ----
  const H = Y2 - 0.3;
  out.side.push(box(-W, -W + 0.5, 0, H, HALL_BACK, -0.6), box(W - 0.5, W, 0, H, HALL_BACK, -0.6), box(-W, W, 0, H, HALL_BACK, HALL_BACK + 0.5));
  const roof = new THREE.Shape();
  roof.moveTo(-W - 0.4, 0); roof.lineTo(W + 0.4, 0); roof.lineTo(0, 3.2); roof.closePath();
  out.roof.push(extrude(roof, HALL_BACK - 0.4, -0.5).translate(0, H, 0));
  // kept a little inside the hall walls so the two surfaces never fight for the same pixels
  const interior = new THREE.Mesh(new THREE.BoxGeometry(2 * W - 1.2, H - 0.1, -HALL_BACK - 1.3).translate(0, H / 2, (HALL_BACK + 0.5 - 0.6) / 2), mats.interior);

  const group = new THREE.Group();
  group.name = 'celsus';
  addGate(out, group);
  buildMeshes(out, mats, group);
  interior.receiveShadow = true;
  group.add(interior);

  // the four virtues: Sophia, Arete, Ennoia, Episteme
  [0xb5853a, 0x8c3a2e, 0x3d5f8a, 0x5c7448].forEach((c, i) => {
    const s = statue(c, i * 1.7);
    s.scale.setScalar(1.42);
    s.position.set(LOWER[i], Y0 + 1.0, -0.28);
    s.rotation.y = (i - 1.5) * -0.06;
    group.add(s);
  });

  // the stair treads are walkable in VR
  group.userData.walkable = group.children[0];
  scene.add(group);
  return group;
}
