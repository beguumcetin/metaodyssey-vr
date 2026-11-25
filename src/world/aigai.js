// Aigai in the Yunt Mountains, 2nd century BC: a hill city of terraces under the kings of Pergamon.
// The three-storey market building holds up the agora; above are the council house, the theatre and a temple.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fluted, strip } from './ruins.js';
import { box, extrude, triangle, wallBlocks, doorFrame, makeMaterials, newParts, buildMeshes, JOINTS } from './celsus.js';
import { heightAt } from './layout.js';
import { patchMaterial } from './shaders.js';

export const LOWER = -14.2;            // the street terrace below the market building
export const MARKET = { x0: -40, x1: 40, back: 9.6, front: 22 };
export const THEATRE = { x: 36, z: -92, r0: 7, rows: 30 };
export const BOULE = { x: -26, z: -44 };
export const TEMPLE = { x: -12, z: -172 };

function doricColumn(h, r) {
  return mergeGeometries([
    strip(fluted(h - 0.42, r, r * 0.78, false, 0)),
    strip(new THREE.CylinderGeometry(r * 1.18, r * 0.8, 0.26, 32).translate(0, h - 0.29, 0)),   // echinus
    box(-r * 1.3, r * 1.3, h - 0.16, h, -r * 1.3, r * 1.3),                                      // abacus
  ]);
}

function triglyphTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#e7dfcf'; x.fillRect(0, 0, 256, 64);                 // metope
  for (const ox of [0, 128]) {
    x.fillStyle = '#34496a'; x.fillRect(ox, 0, 48, 64);                // triglyph, painted blue
    x.fillStyle = '#22324a'; for (const gx of [10, 22, 34]) x.fillRect(ox + gx, 4, 5, 60);
  }
  x.fillStyle = '#a3523a'; x.fillRect(60, 18, 56, 28); x.fillRect(188, 18, 56, 28);   // painted shields on the metopes
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

// A row of Doric columns with architrave and triglyph frieze. dir: +1 faces +z, -1 faces -z.
function doricStoa(out, frieze, cols, x0, x1, z, y, h, step) {
  const r = 0.34;
  for (let x = x0 + step / 2; x < x1; x += step) cols.push(new THREE.Matrix4().makeTranslation(x, y, z));
  out.marble.push(box(x0, x1, y + h, y + h + 0.5, z - 0.45, z + 0.45));
  const fy = y + h + 0.5;
  const g = box(x0, x1, fy, fy + 0.55, z - 0.42, z + 0.42);
  const p = g.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) - x0) / (step * 2); uv[i * 2 + 1] = (p.getY(i) - fy) / 0.55; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  frieze.push(g);
  out.marble.push(box(x0 - 0.1, x1 + 0.1, fy + 0.55, fy + 0.8, z - 0.55, z + 0.6));
  out.paint.push(box(x0 - 0.12, x1 + 0.12, fy + 0.8, fy + 0.84, z - 0.57, z + 0.62));
  return fy + 0.84;
}

// Gabled roof over a box (x0..x1 across, z0..z1 along), with a pediment at the front (z1).
function gable(out, x0, x1, z0, z1, y, rise) {
  const w = x1 - x0, cx = (x0 + x1) / 2;
  out.roof.push(extrude(triangle(w + 0.8, rise + 0.15), z0 - 0.3, z1 - 0.6).translate(cx, y, 0));
  const frame = triangle(w + 0.4, rise);
  frame.holes.push(new THREE.Path(triangle(w - 1.2, rise - 0.6).getPoints().map((p) => p.add(new THREE.Vector2(0, 0.22)))));
  out.marble.push(extrude(frame, z1 - 0.6, z1 + 0.1).translate(cx, y, 0));
  out.tympanum.push(extrude(triangle(w, rise), z1 - 0.7, z1 - 0.35).translate(cx, y, 0));
}

function marketBuilding(out, frieze, cols) {
  const { x0, x1, back, front } = MARKET;
  const top = 5.4;
  // the tall downhill face: two storeys of shops and storerooms below the agora, then the back wall of the stoa
  const openings = [];
  for (let x = x0 + 4; x < x1 - 2; x += 6.4) {
    openings.push([x - 0.9, x + 0.9, LOWER, LOWER + 2.9]);                 // shop doors on the street
    openings.push([x - 0.5, x + 0.5, LOWER + 6.0, LOWER + 7.3]);           // middle storey windows
    openings.push([x - 0.5, x + 0.5, LOWER + 10.6, LOWER + 11.9]);         // upper storey windows
    openings.push([x - 0.35, x + 0.35, 2.4, 3.4]);                         // small windows of the stoa
  }
  for (const b of wallBlocks(openings, x0, x1, LOWER - 0.6, top)) out.wall.push(box(b[0], b[1], b[2], b[3], front - 1, front));
  for (const o of openings) if (o[2] < LOWER + 1) doorFrame(out, ...o);
  // string courses mark the floors
  for (const y of [LOWER + 4.6, LOWER + 9.3, 0]) out.marble.push(box(x0 - 0.1, x1 + 0.1, y - 0.12, y + 0.18, front - 0.2, front + 0.25));
  out.wall.push(box(x0, x0 + 1, LOWER - 0.6, top, back, front), box(x1 - 1, x1, LOWER - 0.6, top, back, front));
  // dark rooms behind the doors and windows
  const dark = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 - 2.2, -LOWER - 0.4, front - back - 2.2).translate(0, LOWER / 2 - 0.1, (back + front) / 2 - 0.3),
    new THREE.MeshBasicMaterial({ color: 0x2b1f16, side: THREE.BackSide }));
  // the agora floor of the stoa, and its colonnade facing the square
  out.marble.push(box(x0, x1, -0.6, 0.0, back - 0.6, front - 1));
  const cTop = doricStoa(out, frieze, cols, x0 + 1, x1 - 1, back, 0, 4.6, 2.7);
  // lean-to roof from the colonnade up to the back wall
  const roof = new THREE.Shape();
  roof.moveTo(back - 1, cTop - 0.1); roof.lineTo(front + 0.4, top + 0.6); roof.lineTo(front + 0.4, top + 0.85); roof.lineTo(back - 1, cTop + 0.15); roof.closePath();
  // the shape is drawn in (z, y): extrude along x, then turn it into place
  out.roof.push(strip(new THREE.ExtrudeGeometry(roof, { depth: x1 - x0 + 1, bevelEnabled: false })).rotateY(-Math.PI / 2).translate(x1 + 0.5, 0, 0));
  return dark;
}

function bouleuterion(out, frieze, cols) {
  const { x, z } = BOULE;
  const y = heightAt(x, z + 12);
  const w = 20, d = 19, h = 9;
  out.marble.push(box(x - w / 2 - 1, x + w / 2 + 1, y - 1.5, y + 0.4, z - d / 2 - 1, z + d / 2 + 4));
  out.side.push(box(x - w / 2, x + w / 2, y + 0.4, y + h, z - d / 2, z - d / 2 + 0.8), box(x - w / 2, x - w / 2 + 0.8, y + 0.4, y + h, z - d / 2, z + d / 2),
    box(x + w / 2 - 0.8, x + w / 2, y + 0.4, y + h, z - d / 2, z + d / 2));
  const doors = [[x - 4.6, x - 2.8, y + 0.4, y + 3.6], [x - 0.9, x + 0.9, y + 0.4, y + 4.2], [x + 2.8, x + 4.6, y + 0.4, y + 3.6]];
  for (const b of wallBlocks(doors, x - w / 2, x + w / 2, y + 0.4, y + h)) out.side.push(box(b[0], b[1], b[2], b[3], z + d / 2 - 0.8, z + d / 2));
  for (const dd of doors) doorFrame(out, ...dd);
  // a porch of four columns in front
  const top = doricStoa(out, frieze, cols, x - w / 2, x + w / 2, z + d / 2 + 3, y + 0.4, h - 1.3, w / 4);
  out.marble.push(box(x - w / 2, x + w / 2, top - 0.84, top, z + d / 2, z + d / 2 + 3));
  gable(out, x - w / 2 - 0.3, x + w / 2 + 0.3, z - d / 2 - 0.3, z + d / 2 + 3.8, top, 3.2);
  return new THREE.Mesh(new THREE.BoxGeometry(w - 1.8, h - 0.6, d - 1.8).translate(x, y + 0.45 + (h - 0.6) / 2, z),
    new THREE.MeshBasicMaterial({ color: 0x2b1f16, side: THREE.BackSide }));
}

// Height of the theatre's seats at distance r from the centre of the orchestra.
export function theatreSeatY(r) {
  const { r0 } = THEATRE;
  const k = Math.floor((r - r0) / 0.8);
  return theatreBase() + Math.max(0, k + 1) * 0.42;
}
const theatreBase = () => heightAt(THEATRE.x, THEATRE.z + 9) + 0.2;

function theatre(group, mats) {
  const { x, z, r0, rows } = THEATRE;
  const y0 = theatreBase();
  // stepped seating revolved around the orchestra, opening towards +z
  const pts = [new THREE.Vector2(r0, -12)];
  for (let k = 0; k <= rows; k++) {
    const r = r0 + k * 0.8, y = k * 0.42;
    pts.push(new THREE.Vector2(r, y), new THREE.Vector2(r, y + 0.42));
    if (k < rows) pts.push(new THREE.Vector2(r + 0.8, y + 0.42));
  }
  const rEnd = r0 + rows * 0.8;
  pts.push(new THREE.Vector2(rEnd + 1.2, rows * 0.42 + 0.42), new THREE.Vector2(rEnd + 1.2, -12));
  const cavea = new THREE.LatheGeometry(pts.reverse(), 64, Math.PI / 2 - 0.25, Math.PI + 0.5).translate(x, y0, z);
  const m = new THREE.Mesh(cavea, mats.marble);
  m.castShadow = true; m.receiveShadow = true;
  group.add(m);
  const orchestra = new THREE.Mesh(new THREE.CircleGeometry(r0, 48).rotateX(-Math.PI / 2).translate(x, y0 + 0.02, z), mats.marble);
  orchestra.receiveShadow = true;
  group.add(orchestra);
  return m;
}

// The stage: a low two-storey scene building with a colonnaded front (proskenion) for the actors.
function stageBuilding(out, cols) {
  const { x, z, r0 } = THEATRE;
  const y = theatreBase();
  const z0 = z + r0 + 1.5;
  out.side.push(box(x - 12, x + 12, y - 1, y + 5.2, z0 + 3, z0 + 6.5));
  const doors = [[x - 5, x - 3.4, y + 2.9, y + 4.7], [x - 1, x + 1, y + 2.9, y + 5.0], [x + 3.4, x + 5, y + 2.9, y + 4.7]];
  for (const b of wallBlocks(doors, x - 12, x + 12, y - 1, y + 5.2)) out.marble.push(box(b[0], b[1], b[2], b[3], z0 + 2.75, z0 + 3));
  for (const d of doors) doorFrame(out, ...d);
  // proskenion: a row of small columns carrying the raised stage floor
  for (let k = 0; k < 9; k++) cols.push(new THREE.Matrix4().compose(new THREE.Vector3(x - 10 + k * 2.5, y, z0 + 0.3),
    new THREE.Quaternion(), new THREE.Vector3(0.62, 0.62, 0.62)));
  out.marble.push(box(x - 11, x + 11, y + 2.75, y + 2.95, z0, z0 + 3), box(x - 11, x + 11, y - 1, y + 2.75, z0 + 2.6, z0 + 3));
  out.roof.push(box(x - 12.3, x + 12.3, y + 5.2, y + 5.6, z0 + 2.8, z0 + 6.8));
}

function temple(out, cols) {
  const { x, z } = TEMPLE;
  const y = heightAt(x, z) + 0.2;
  const w = 12, l = 24, colH = 6.2;
  for (let k = 0; k < 3; k++) out.marble.push(box(x - w / 2 - 1.2 + k * 0.4, x + w / 2 + 1.2 - k * 0.4, y - 2, y + (k + 1) * 0.3, z - l / 2 - 1.2 + k * 0.4, z + l / 2 + 1.2 - k * 0.4));
  const top = y + 0.9;
  const xs = [0, 1, 2, 3, 4, 5].map((i) => x - w / 2 + 0.8 + i * ((w - 1.6) / 5));
  for (const zz of [z + l / 2 - 0.8, z - l / 2 + 0.8]) for (const xx of xs) cols.push(new THREE.Matrix4().makeTranslation(xx, top, zz));
  for (let i = 1; i < 10; i++) for (const xx of [x - w / 2 + 0.8, x + w / 2 - 0.8]) cols.push(new THREE.Matrix4().makeTranslation(xx, top, z - l / 2 + 0.8 + i * ((l - 1.6) / 10)));
  out.wall.push(box(x - 3.6, x + 3.6, top, top + colH, z - l / 2 + 3, z + l / 2 - 4));
  out.marble.push(box(x - w / 2, x + w / 2, top + colH, top + colH + 1.3, z - l / 2, z + l / 2));
  gable(out, x - w / 2, x + w / 2, z - l / 2, z + l / 2, top + colH + 1.3, 2.4);
}

export function addAigai(scene, manager) {
  const mats = makeMaterials(manager);
  mats.triglyph = patchMaterial(new THREE.MeshStandardMaterial({ map: triglyphTexture(), roughness: 0.7 }), { cloud: true, key: 'aigai-triglyph' });
  mats.stone = patchMaterial(new THREE.MeshStandardMaterial({ color: 0x9a8a70, roughness: 0.95 }), { cloud: true, key: 'aigai-stone', extra: JOINTS(0.5, 1.1) });
  const out = newParts();
  const frieze = [], cols = [], templeCols = [];
  const group = new THREE.Group();
  group.name = 'aigai';

  const dark = marketBuilding(out, frieze, cols);
  const hall = bouleuterion(out, frieze, cols);
  stageBuilding(out, cols);
  temple(out, templeCols);
  const cavea = theatre(group, mats);
  // retaining walls: along the front of the lower terrace, and terraces either side of the market building
  out.stone = [];
  out.stone.push(box(-56, 56, LOWER - 9, LOWER + 0.4, 44.5, 46));
  for (const sx of [-1, 1]) {
    out.stone.push(box(Math.min(sx * 40, sx * 60), Math.max(sx * 40, sx * 60), LOWER - 1, 0.3, MARKET.back - 6, MARKET.front + 0.6));
  }

  buildMeshes(out, mats, group);
  const fm = new THREE.Mesh(mergeGeometries(frieze), mats.triglyph);
  fm.castShadow = true;
  group.add(fm, dark, hall);
  for (const [list, geo] of [[cols, doricColumn(4.6, 0.34)], [templeCols, doricColumn(6.2, 0.45)]]) {
    const im = new THREE.InstancedMesh(geo, mats.marble, list.length);
    list.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = true; im.receiveShadow = true;
    im.computeBoundingSphere();
    group.add(im);
  }
  group.userData.walkable = [group.children.find((c) => c.isMesh && c.material === mats.marble), cavea];
  scene.add(group);
  return { group };
}
