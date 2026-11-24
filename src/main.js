import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { sites, upcoming } from './content.js';

const params = new URLSearchParams(location.search);
const site = sites.find((x) => x.id === params.get('site')) || null;   // null = museum hall
const mood = params.get('mood') === 'golden' ? 'golden' : 'day';      // ?mood=golden: low evening sun

const GOLD = 0xd9b26a;
const NAVY = 0x0d1530;

// ---------- renderer, scene, camera ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.xr.enabled = true;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.05, 6000);
const rig = new THREE.Group();          // moved when teleporting in VR
rig.add(camera);
scene.add(rig);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;

const gltfLoader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/');
gltfLoader.setDRACOLoader(draco);
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

const hotspotMeshes = [];   // info points (site view)
const exhibits = [];        // clickable plinths (hall view)
let floor;                  // teleport surface
let floorY = 0;             // ground height under the visitor
let vrStart = [0, 15];

setupUi();
if (site) buildSite(site); else buildHall();

// =====================================================================
// Site view: one stop at full scale, in daylight
// =====================================================================
async function buildSite(s) {
  setupDaylight(s);
  vrStart = s.vrStart;

  const object = await loadScan(s);
  scene.add(object);
  floorY = s.floor ? 0 : estimateGround(object);
  applyFade(object, s.fade, s.ground);
  floor.position.y = floorY - (s.floor ? 0.02 : 0.25);

  if (s.camera) {
    const lift = new THREE.Vector3(0, floorY, 0);
    camera.position.set(...s.camera.position).add(lift);
    controls.target.set(...s.camera.target).add(lift);
  } else {
    frameObject(object);
  }
  controls.maxDistance = s.fade.radius * 2.2;
  controls.minDistance = 2;

  for (const h of s.hotspots) {
    const [x, y, z] = h.position;
    const marker = makeHotspot({ ...h, position: [x, y + floorY, z] });
    marker.scale.setScalar(s.hotspotSize || 1);
    hotspotMeshes.push(marker);
  }
  if (params.has('grid')) {
    const grid = new THREE.GridHelper(200, 20, 0xff3355, 0x66ccff);
    grid.position.y = floorY + 0.3;
    scene.add(grid);
  }
  doneLoading();
}

function setupDaylight(s) {
  const golden = mood === 'golden';
  const sky = new Sky();
  sky.scale.setScalar(5000);
  const u = sky.material.uniforms;
  u.turbidity.value = golden ? 8 : 4;
  u.rayleigh.value = golden ? 2.2 : 1.2;
  u.mieCoefficient.value = 0.005;
  u.mieDirectionalG.value = 0.85;
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1,
    THREE.MathUtils.degToRad(90 - (golden ? 5 : 38)), THREE.MathUtils.degToRad(golden ? 200 : 160));
  u.sunPosition.value.copy(sunDir);
  scene.add(sky);
  renderer.toneMappingExposure = golden ? 0.45 : 0.42;

  const horizon = golden ? 0xd9b08c : 0xc9d6e2;
  const size = s.fade.radius;
  scene.fog = new THREE.Fog(horizon, size * 2.5, size * 14);

  // Ground: unlit like the scans, same colour as the fade, so the edge disappears.
  floor = new THREE.Mesh(
    new THREE.CircleGeometry(4000, 96).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: s.ground, map: terrainTexture(), toneMapped: false })
  );
  floor.material.map.repeat.set(120, 120);   // one tile ≈ 65 m
  scene.add(floor);
  scene.add(makeHills(s.fade.radius * 9, s.ground, horizon));
}

// A ring of low, soft hills on the horizon so the site sits in a landscape.
function makeHills(radius, groundColor, horizon) {
  const seg = 180, geo = new THREE.BufferGeometry();
  const pos = [], col = [], idx = [];
  const near = new THREE.Color(groundColor).multiplyScalar(0.85), far = new THREE.Color(horizon);
  const peak = (a) => 0.5 + 0.5 * Math.sin(a * 3 + 1.3) * Math.sin(a * 7 + 0.4) + 0.25 * Math.sin(a * 17);
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const h = radius * (0.035 + 0.05 * Math.max(0, peak(a)));
    const x = Math.cos(a) * radius, z = Math.sin(a) * radius;
    pos.push(x, -2, z, x * 1.05, h, z * 1.05);
    const c = near.clone().lerp(far, 0.55);
    col.push(c.r, c.g, c.b, far.r, far.g, far.b);
    if (i < seg) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false, fog: false }));
}

// =====================================================================
// Museum hall: every stop as a model on a plinth
// =====================================================================
async function buildHall() {
  const W = 14, L = 30, H = 6.5;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.background = new THREE.Color(0x070b18);
  renderer.toneMappingExposure = 1.0;

  // Floor: pale polished marble.
  floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W, L).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: marbleTexture(), roughness: 0.22, metalness: 0 })
  );
  floor.material.map.repeat.set(4, 10);
  scene.add(floor);

  // Walls and ceiling: deep navy, the MetaOdyssey night.
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x15204a, roughness: 0.85 });
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0x0a1028, roughness: 1 });
  const hidden = new THREE.MeshBasicMaterial({ visible: false });   // the marble floor replaces the box bottom
  const room = new THREE.Mesh(new THREE.BoxGeometry(W, H, L), [wallMat, wallMat, ceilMat, hidden, wallMat, wallMat]);
  room.geometry.scale(-1, 1, 1);   // faces inward
  room.position.y = H / 2;
  scene.add(room);

  // Gold lines along the walls, skylight strip in the ceiling.
  const goldMat = new THREE.MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.3 });
  for (const x of [-W / 2 + 0.01, W / 2 - 0.01]) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, L), goldMat);
    line.position.set(x, 3.2, 0);
    scene.add(line);
  }
  // Row of small warm ceiling lights instead of one bright strip.
  for (let z = -L / 2 + 3; z < L / 2 - 1; z += 3) {
    const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.18, 24).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffe2b0 }));
    lamp.position.set(0, H - 0.01, z);
    scene.add(lamp);
  }
  scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x2a2418, 0.5));

  // Title on the end wall.
  await document.fonts.load('700 120px "Cinzel Decorative"');
  await document.fonts.load('italic 500 60px "Cormorant Garamond"');
  const title = textPlane(2048, 512, 11, 2.75, (g, w, h) => {
    const grad = g.createLinearGradient(0, 120, 0, 300);
    grad.addColorStop(0, '#f6dfa4'); grad.addColorStop(1, '#b8893d');
    g.fillStyle = grad; g.font = '700 220px "Cinzel Decorative"'; g.textAlign = 'center';
    g.fillText('MetaOdyssey', w / 2, 290);
    g.fillStyle = '#d8cfbd'; g.font = 'italic 500 84px "Cormorant Garamond"';
    g.fillText('Virtual Museum of Ancient Ionia and Lydia', w / 2, 430);
  });
  title.position.set(0, 4.3, -L / 2 + 0.02);
  scene.add(title);

  // Plinths.
  const loads = sites.map(async (s) => {
    const group = makePlinth(s.hall, s.city, s.place, 'Click to step inside');
    const scan = await loadScan(s);
    const ground = s.floor ? 0 : estimateGround(scan);
    const wrapper = new THREE.Group().add(scan);
    const k = 1.42 / s.fade.radius;               // scan circle → plinth top
    wrapper.scale.setScalar(k);
    wrapper.position.set(s.hall[0] - s.fade.center[0] * k, 1.0 - ground * k, s.hall[1] - s.fade.center[1] * k);
    scene.add(wrapper);
    wrapper.updateMatrixWorld(true);
    applyFade(scan, s.fade, NAVY, wrapper.matrixWorld.clone().invert());
    group.userData.siteId = s.id;
    exhibits.push(group, wrapper);
    wrapper.userData.siteId = s.id;
  });
  for (const u of upcoming) {
    const group = makePlinth(u.hall, u.city, u.place, u.note);
    group.add(makeScanPlaceholder());
  }
  await Promise.all(loads);

  camera.position.set(0, 2.4, 13.5);
  controls.target.set(0, 1.2, 0.5);
  controls.minDistance = 2;
  controls.maxDistance = 14;
  vrStart = [0, 12];
  doneLoading();
}

function makePlinth([x, z], city, place, note) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 1.0, 64),
    new THREE.MeshStandardMaterial({ color: NAVY, roughness: 0.35, metalness: 0.2 }));
  body.position.y = 0.5;
  const top = new THREE.Mesh(new THREE.CircleGeometry(1.5, 64).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: NAVY, toneMapped: false }));
  top.position.y = 1.001;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.018, 8, 96).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.25 }));
  ring.position.y = 1.0;
  group.add(body, top, ring);

  // Lectern with the label, on the aisle side.
  const side = x < 0 ? 1 : -1;
  const plaque = textPlane(1024, 512, 1.1, 0.55, (g, w, h) => {
    g.fillStyle = '#0d1530'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d9b26a'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
    g.fillStyle = '#e8c77e'; g.font = '700 96px "Cinzel Decorative"'; g.fillText(city, 56, 150);
    g.fillStyle = '#efe6d2'; g.font = 'italic 500 64px "Cormorant Garamond"'; g.fillText(place, 58, 240);
    g.fillStyle = '#b9b2a3'; g.font = '34px "Instrument Sans"'; wrapText(g, note, 58, 330, w - 116, 46);
  });
  plaque.position.set(side * 2.05, 1.0, 1.1);
  plaque.rotation.set(-0.45, side * 0.6, 0, 'YXZ');
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.95, 0.08),
    new THREE.MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.3 }));
  stand.position.set(side * 2.05, 0.47, 1.1);
  group.add(plaque, stand);

  const spot = new THREE.SpotLight(0xfff0d8, 40, 12, 0.42, 0.7, 2);
  spot.position.set(0, 6.6, 1.5);
  spot.target = body;
  group.add(spot);

  scene.add(group);
  return group;
}

// Aigai is not scanned yet: a slowly turning gold point cloud.
function makeScanPlaceholder() {
  const n = 2600, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 1.3;
    const h = Math.random() < 0.55 ? Math.random() * 0.12 : Math.random() * 0.75 * (1 - r / 1.4);
    pos.set([Math.cos(a) * r, 1.02 + h, Math.sin(a) * r], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const cloud = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xf2c96b, size: 0.025, transparent: true, opacity: 0.85 }));
  cloud.userData.spin = true;
  return cloud;
}

// =====================================================================
// Shared: loading scans, fading their edges
// =====================================================================
async function loadScan(s) {
  const gltf = await gltfLoader.loadAsync(s.model);
  gltf.scene.rotation.y = s.transform.rotationY;   // rotate inside a wrapper, then centre the wrapper
  const object = new THREE.Group().add(gltf.scene);
  fitModel(object, s.fit);
  object.position.add(new THREE.Vector3(...s.transform.position));
  object.traverse((o) => {
    if (o.isMesh) for (const m of [].concat(o.material)) m.toneMapped = false;   // show the photos' own colours
  });
  object.updateMatrixWorld(true);
  return object;
}

// Scale a model (by height or by longest horizontal side), base on y = 0, centred on x/z.
function fitModel(object, fit) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  if (fit.height && size.y > 0) object.scale.setScalar(fit.height / size.y);
  else if (fit.size) object.scale.setScalar(fit.size / Math.max(size.x, size.z));
  box.setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  object.position.x -= center.x;
  object.position.z -= center.z;
  object.position.y -= box.min.y;
}

// Fade the scan into `color` towards the edge of a circle and cut it off there.
// siteMatrix maps world space back to the site's own metres (identity at full scale).
function applyFade(object, fade, color, siteMatrix = new THREE.Matrix4()) {
  const uniforms = {
    uFadeCenter: { value: new THREE.Vector2(...fade.center) },
    uFadeRadius: { value: fade.radius },
    uFadeWidth: { value: fade.width },
    uFadeColor: { value: new THREE.Color(color) },
    uSiteMatrix: { value: siteMatrix },
  };
  object.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, uniforms);
        sh.vertexShader = 'uniform mat4 uSiteMatrix;\nvarying vec3 vSitePos;\n' + sh.vertexShader.replace(
          '#include <project_vertex>',
          '#include <project_vertex>\n  vSitePos = (uSiteMatrix * modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = 'uniform vec2 uFadeCenter;\nuniform float uFadeRadius;\nuniform float uFadeWidth;\nuniform vec3 uFadeColor;\nvarying vec3 vSitePos;\n' + sh.fragmentShader.replace(
          '#include <opaque_fragment>',
          `#include <opaque_fragment>
  { float d = distance(vSitePos.xz, uFadeCenter);
    if (d > uFadeRadius) discard;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, uFadeColor, smoothstep(uFadeRadius - uFadeWidth, uFadeRadius, d)); }`);
      };
      m.customProgramCacheKey = () => 'fade';
      m.needsUpdate = true;
    }
  });
}

// Median height of the terrain under a 7x7 grid, so the visitor stands on the ground.
function estimateGround(object) {
  const box = new THREE.Box3().setFromObject(object);
  const ray = new THREE.Raycaster();
  const heights = [];
  for (let i = 1; i < 8; i++) for (let j = 1; j < 8; j++) {
    const x = box.min.x + (box.max.x - box.min.x) * i / 8;
    const z = box.min.z + (box.max.z - box.min.z) * j / 8;
    ray.set(new THREE.Vector3(x, box.max.y + 10, z), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(object, true)[0];
    if (hit) heights.push(hit.point.y);
  }
  heights.sort((a, b) => a - b);
  return heights.length ? heights[Math.floor(heights.length / 2)] : 0;
}

function frameObject(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const r = Math.max(size.x, size.z);
  controls.target.copy(center);
  camera.position.set(center.x, center.y + r * 0.32, center.z + r * 0.55);
}

// =====================================================================
// Info points and text
// =====================================================================
function makeHotspot(data) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 16), new THREE.MeshBasicMaterial({ color: 0xf2c96b, toneMapped: false }));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xf2c96b, transparent: true, opacity: 0.3, depthWrite: false, toneMapped: false }));
  mesh.add(halo);
  mesh.position.set(...data.position);
  mesh.userData = { ...data, halo };
  scene.add(mesh);
  return mesh;
}

const panelEl = document.getElementById('panel');
function showPanel(data) {
  document.getElementById('panel-title').textContent = data.title;
  document.getElementById('panel-body').textContent = data.body;
  panelEl.hidden = false;
}
document.getElementById('panel-close').onclick = () => { panelEl.hidden = true; };

// In VR there is no HTML, so the text is drawn on a floating board.
let vrBoard = null;
function showVrBoard(hotspot) {
  if (vrBoard) { scene.remove(vrBoard); vrBoard.material.map.dispose(); }
  const { title, body } = hotspot.userData;
  vrBoard = textPlane(1024, 640, 1.6, 1.0, (g, w, h) => {
    g.fillStyle = 'rgba(11,20,48,0.92)'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d9b26a'; g.lineWidth = 4; g.strokeRect(12, 12, w - 24, h - 24);
    g.fillStyle = '#d9b26a'; g.font = '600 56px "Cormorant Garamond", serif'; g.fillText(title, 56, 110);
    g.fillStyle = '#f3ead8'; g.font = '34px "Instrument Sans", sans-serif'; wrapText(g, body, 56, 180, w - 112, 48);
  });
  const camPos = camera.getWorldPosition(new THREE.Vector3());
  const dir = camPos.clone().sub(hotspot.position).setY(0).normalize();
  vrBoard.position.copy(hotspot.position).addScaledVector(dir, 1.2).setY(Math.max(hotspot.position.y, floorY + 1.6));
  vrBoard.lookAt(camPos.x, vrBoard.position.y, camPos.z);
  scene.add(vrBoard);
}

function textPlane(pw, ph, w, h, draw) {
  const c = document.createElement('canvas');
  c.width = pw; c.height = ph;
  draw(c.getContext('2d'), pw, ph);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
}

function wrapText(g, text, x, y, maxW, lineH) {
  let line = '';
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (g.measureText(test).width > maxW && line) { g.fillText(line, x, y); line = word; y += lineH; }
    else line = test;
  }
  g.fillText(line, x, y);
}

// =====================================================================
// Input: mouse/touch, VR controllers
// =====================================================================
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downAt = null;

function pickTarget() {
  const spot = raycaster.intersectObjects(hotspotMeshes, false)[0];
  if (spot) return { hotspot: spot.object };
  const ex = raycaster.intersectObjects(exhibits, true)[0];
  if (ex) {
    let o = ex.object;
    while (o && !o.userData.siteId) o = o.parent;
    if (o) return { siteId: o.userData.siteId };
  }
  return null;
}

renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!exhibits.length && !hotspotMeshes.length) return;
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  renderer.domElement.style.cursor = pickTarget() ? 'pointer' : '';
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;   // was a drag
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const t = pickTarget();
  if (t?.hotspot) showPanel(t.hotspot.userData);
  else if (t?.siteId) location.search = `?site=${t.siteId}`;
});

document.getElementById('vr-slot').appendChild(VRButton.createButton(renderer));

const tempMatrix = new THREE.Matrix4();
const teleportMarker = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.32, 32).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0xf2c96b, toneMapped: false }));
teleportMarker.visible = false;
scene.add(teleportMarker);

const controllers = [0, 1].map((i) => {
  const ctrl = renderer.xr.getController(i);
  const ray = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]),
    new THREE.LineBasicMaterial({ color: 0xf2c96b }));
  ray.scale.z = 15;
  ctrl.add(ray);
  ctrl.addEventListener('selectend', () => onVrSelect(ctrl));
  rig.add(ctrl);
  return ctrl;
});

function controllerRay(ctrl) {
  tempMatrix.identity().extractRotation(ctrl.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(ctrl.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
}

function onVrSelect(ctrl) {
  controllerRay(ctrl);
  const t = pickTarget();
  if (t?.hotspot) { showVrBoard(t.hotspot); return; }
  if (t?.siteId) { location.search = `?site=${t.siteId}`; return; }
  const ground = floor && raycaster.intersectObject(floor, false)[0];
  if (ground) {
    const head = camera.getWorldPosition(new THREE.Vector3());
    rig.position.x += ground.point.x - head.x;
    rig.position.z += ground.point.z - head.z;
  }
}

let desktopView = null;
renderer.xr.addEventListener('sessionstart', () => {
  desktopView = camera.position.clone();
  controls.enabled = false;
  rig.position.set(vrStart[0], floorY, vrStart[1]);
  camera.position.set(0, 0, 0);   // headset supplies the head pose
});
renderer.xr.addEventListener('sessionend', () => {
  controls.enabled = true;
  rig.position.set(0, 0, 0);
  if (desktopView) camera.position.copy(desktopView);
  if (vrBoard) { scene.remove(vrBoard); vrBoard = null; }
});

// =====================================================================
// Page UI
// =====================================================================
function setupUi() {
  const sub = site ? `${site.city} · ${site.place}` : 'Virtual Museum';
  document.querySelector('.top .sub').textContent = sub;
  document.title = site ? `MetaOdyssey: ${site.city}, ${site.place}` : 'MetaOdyssey Virtual Museum';
  document.getElementById('loading').textContent = site ? `Loading ${site.place}…` : 'Opening the museum…';
  document.querySelector('.hint').textContent = site
    ? 'Drag to look around · scroll to zoom · click the golden points'
    : 'Drag to look around · click an exhibit to step inside';
  document.getElementById('sites').innerHTML =
    `<a href="./" class="${site ? '' : 'active'}"><b>Museum</b> Hall</a>` +
    sites.map((x) => `<a href="?site=${x.id}" class="${x.id === site?.id ? 'active' : ''}"><b>${x.city}</b> ${x.place}</a>`).join('') +
    upcoming.map((x) => `<span class="soon"><b>${x.city}</b> December</span>`).join('');
  document.getElementById('credits-body').innerHTML = sites.map(({ city, place, credit: c }) =>
    `<p><b>${city} · ${place}:</b> <a href="${c.url}" target="_blank" rel="noopener">${c.work}</a> by ${c.author}, ${c.license}. Simplified and compressed for web and VR.</p>`
  ).join('') + '<p>MetaOdyssey · Erasmus+ 2025-3-TR01-KA152-YOU-000382053</p>';
  document.getElementById('credits-btn').onclick = () => { document.getElementById('credits').hidden = false; };
  document.querySelector('[data-close="credits"]').onclick = () => { document.getElementById('credits').hidden = true; };
}

function doneLoading() { document.getElementById('loading').classList.add('done'); }

// =====================================================================
// Loop
// =====================================================================
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  for (const h of hotspotMeshes) h.userData.halo.scale.setScalar(1 + 0.25 * Math.sin(t * 2.5));
  scene.traverse((o) => { if (o.userData.spin) o.rotation.y = t * 0.15; });

  if (renderer.xr.isPresenting) {
    teleportMarker.visible = false;
    for (const ctrl of controllers) {
      controllerRay(ctrl);
      const ground = floor && raycaster.intersectObject(floor, false)[0];
      if (ground) { teleportMarker.position.copy(ground.point).setY(ground.point.y + 0.02); teleportMarker.visible = true; }
    }
  } else {
    controls.update();
    if (!site) {   // keep the camera inside the hall
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -6.4, 6.4);
      camera.position.y = THREE.MathUtils.clamp(camera.position.y, 0.6, 6.4);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, -14.4, 14.4);
    }
  }
  renderer.render(scene, camera);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// =====================================================================
// Procedural textures
// =====================================================================
// Grass-and-earth patches plus fine grain, roughly neutral around 1.0 so the colour comes from the material.
function terrainTexture() {
  const s = 1024, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(232,232,232)'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 420; i++) {
    const x = Math.random() * s, y = Math.random() * s, r = 20 + Math.random() * 110;
    const light = Math.random() < 0.5;
    const tint = light ? '255,250,235' : '170,175,150';
    for (const [dx, dy] of [[0, 0], [s, 0], [-s, 0], [0, s], [0, -s]]) {   // wrap so the tile repeats seamlessly
      const grd = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      grd.addColorStop(0, `rgba(${tint},0.22)`); grd.addColorStop(1, `rgba(${tint},0)`);
      g.fillStyle = grd; g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
    }
  }
  const img = g.getImageData(0, 0, s, s);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 26;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function noiseTexture() {
  const s = 256, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d'), img = g.createImageData(s, s);
  for (let i = 0; i < s * s; i++) {
    const v = 225 + Math.random() * 30;
    img.data.set([v, v, v, 255], i * 4);
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function marbleTexture() {
  const s = 1024, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.fillStyle = '#e9e2d4'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 26; i++) {   // soft grey veins
    g.strokeStyle = `rgba(120,110,95,${0.04 + Math.random() * 0.08})`;
    g.lineWidth = 1 + Math.random() * 3;
    g.beginPath();
    let x = Math.random() * s, y = Math.random() * s;
    g.moveTo(x, y);
    for (let k = 0; k < 12; k++) { x += (Math.random() - 0.3) * 120; y += (Math.random() - 0.5) * 120; g.lineTo(x, y); }
    g.stroke();
  }
  g.strokeStyle = 'rgba(90,80,70,0.25)'; g.lineWidth = 3;   // tile joints
  g.strokeRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
