import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { sites } from './content.js';

const site = sites.find((x) => x.id === new URLSearchParams(location.search).get('site')) || sites[0];

// ---------- renderer, scene, camera ----------
const container = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.xr.enabled = true;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0b1430, 60, 220);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.05, 500);
const rig = new THREE.Group();          // moved when teleporting in VR
rig.add(camera);
scene.add(rig);
camera.position.set(0, 5, 30);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 7, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 4;
controls.maxDistance = 70;

// ---------- sky, light, ground ----------
scene.add(makeSky());
scene.add(makeStars());

scene.add(new THREE.HemisphereLight(0x9fb4ff, 0x3a2a18, 0.9));
const sun = new THREE.DirectionalLight(0xffd59a, 2.2);   // low golden evening light
sun.position.set(-30, 25, 35);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -10, far: 120 });
scene.add(sun);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(400, 64),
  new THREE.MeshStandardMaterial({ color: 0x8a7a63, roughness: 0.95 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
floor.name = 'floor';
scene.add(floor);

// ---------- site ----------
const hotspotMeshes = [];
let floorY = 0;   // ground height under the visitor (drone scans have uneven terrain)
if (!site.floor) floor.material.color.set(0x4a4033);   // dark ground under scans with their own terrain
const debug = new URLSearchParams(location.search);   // ?grid=1 adds a 10 m grid, ?top=1 looks straight down
document.querySelector('.top .sub').textContent = `Virtual Museum · ${site.city} · ${site.place}`;
document.getElementById('loading').textContent = `Loading ${site.place}…`;
document.title = `MetaOdyssey Virtual Museum: ${site.city}`;
document.getElementById('sites').innerHTML = sites.map((x) =>
  `<a href="?site=${x.id}" class="${x.id === site.id ? 'active' : ''}"><b>${x.city}</b> ${x.place}</a>`).join('');

const gltfLoader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/');
gltfLoader.setDRACOLoader(draco);
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

loadSite(site);

async function loadSite(s) {
  let object;
  try {
    const gltf = await gltfLoader.loadAsync(s.model);
    gltf.scene.rotation.y = s.transform.rotationY;   // rotate inside a wrapper, then centre the wrapper
    object = new THREE.Group().add(gltf.scene);
    fitModel(object, s.fit);
  } catch (err) {
    console.warn(`[MetaOdyssey] ${s.model} could not be loaded, showing placeholder.`, err);
    object = buildPlaceholderFacade();
  }
  object.position.add(new THREE.Vector3(...s.transform.position));
  object.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(object);
  object.updateMatrixWorld(true);

  if (!s.floor) {
    floorY = estimateGround(object);
    floor.position.y = new THREE.Box3().setFromObject(object).min.y - 0.05;
  }
  if (debug.has('grid')) {
    const grid = new THREE.GridHelper(200, 20, 0xff3355, 0x66ccff);
    grid.position.y = floorY + 0.3;
    scene.add(grid, new THREE.AxesHelper(20));
  }
  if (s.camera) {
    const lift = new THREE.Vector3(0, floorY, 0);
    camera.position.set(...s.camera.position).add(lift);
    controls.target.set(...s.camera.target).add(lift);
  } else {
    frameObject(object);
  }
  if (debug.has('top')) {
    const r = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
    controls.target.set(0, floorY, 0);
    camera.position.set(0, floorY + Math.max(r.x, r.z) * 1.1, 0.01);
  }
  // Hotspot heights are measured from the ground the visitor stands on.
  for (const h of s.hotspots) {
    const [x, y, z] = h.position;
    const marker = makeHotspot({ ...h, position: [x, y + floorY, z] });
    marker.scale.setScalar(s.hotspotSize || 1);
    hotspotMeshes.push(marker);
  }
  document.getElementById('loading').classList.add('done');
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
  camera.position.set(center.x, center.y + r * 0.38, center.z + r * 0.62);
  controls.maxDistance = r * 2;
}

// ---------- hotspots ----------
function makeHotspot(data) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xf2c96b })
  );
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xf2c96b, transparent: true, opacity: 0.25, depthWrite: false })
  );
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
  vrBoard = makeTextBoard(hotspot.userData.title, hotspot.userData.body);
  const camPos = new THREE.Vector3();
  camera.getWorldPosition(camPos);
  const dir = camPos.clone().sub(hotspot.position).setY(0).normalize();
  vrBoard.position.copy(hotspot.position).addScaledVector(dir, 1.2).setY(Math.max(hotspot.position.y, 1.6));
  vrBoard.lookAt(camPos.x, vrBoard.position.y, camPos.z);
  scene.add(vrBoard);
}

function makeTextBoard(title, body) {
  const w = 1024, h = 640;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(11,20,48,0.92)'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#d9b26a'; g.lineWidth = 4; g.strokeRect(12, 12, w - 24, h - 24);
  g.fillStyle = '#d9b26a'; g.font = '600 56px "Cormorant Garamond", serif';
  g.fillText(title, 56, 110);
  g.fillStyle = '#f3ead8'; g.font = '34px "Instrument Sans", sans-serif';
  wrapText(g, body, 56, 180, w - 112, 48);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
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

// ---------- desktop / mobile picking ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downAt = null;
renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return; // was a drag
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(hotspotMeshes, false)[0];
  if (hit) showPanel(hit.object.userData);
});

// ---------- VR: controllers, teleport ----------
document.getElementById('vr-slot').appendChild(VRButton.createButton(renderer));

const tempMatrix = new THREE.Matrix4();
const teleportMarker = new THREE.Mesh(
  new THREE.RingGeometry(0.25, 0.32, 32).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0xf2c96b })
);
teleportMarker.visible = false;
scene.add(teleportMarker);

const controllers = [0, 1].map((i) => {
  const ctrl = renderer.xr.getController(i);
  const ray = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]),
    new THREE.LineBasicMaterial({ color: 0xf2c96b })
  );
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
  const spot = raycaster.intersectObjects(hotspotMeshes, false)[0];
  if (spot) { showVrBoard(spot.object); return; }
  const ground = raycaster.intersectObject(floor, false)[0];
  if (ground) {
    // Move the rig so the user's head ends up above the hit point.
    const head = new THREE.Vector3();
    camera.getWorldPosition(head);
    rig.position.x += ground.point.x - head.x;
    rig.position.z += ground.point.z - head.z;
  }
}

renderer.xr.addEventListener('sessionstart', () => {
  controls.enabled = false;
  rig.position.set(site.vrStart[0], floorY, site.vrStart[1]);
  camera.position.set(0, 0, 0); // headset supplies the head pose
});
renderer.xr.addEventListener('sessionend', () => {
  controls.enabled = true;
  rig.position.set(0, 0, 0);
  camera.position.set(0, 5, 30);
  if (vrBoard) { scene.remove(vrBoard); vrBoard = null; }
});

// ---------- credits ----------
document.getElementById('credits-body').innerHTML = sites.map(({ city, place, credit: c }) =>
  `<p><b>${city} · ${place}:</b> <a href="${c.url}" target="_blank" rel="noopener">${c.work}</a> by ${c.author}, ${c.license}. Simplified and compressed for web and VR.</p>`
).join('') + '<p>MetaOdyssey · Erasmus+ 2025-3-TR01-KA152-YOU-000382053</p>';
document.getElementById('credits-btn').onclick = () => { document.getElementById('credits').hidden = false; };
document.querySelector('[data-close="credits"]').onclick = () => { document.getElementById('credits').hidden = true; };

// ---------- loop ----------
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  for (const h of hotspotMeshes) h.userData.halo.scale.setScalar(1 + 0.25 * Math.sin(t * 2.5));

  if (renderer.xr.isPresenting) {
    teleportMarker.visible = false;
    for (const ctrl of controllers) {
      controllerRay(ctrl);
      const ground = raycaster.intersectObject(floor, false)[0];
      if (ground) { teleportMarker.position.copy(ground.point).setY(0.02); teleportMarker.visible = true; }
    }
  } else {
    controls.update();
  }
  renderer.render(scene, camera);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- helpers: sky, stars, placeholder ----------
function makeSky() {
  const geo = new THREE.SphereGeometry(300, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x070d24) }, bottom: { value: new THREE.Color(0x3a3350) }, glow: { value: new THREE.Color(0xc98a4b) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform vec3 top, bottom, glow; varying vec3 vP;
      void main(){ float h = clamp(vP.y, 0., 1.);
        vec3 c = mix(bottom, top, pow(h, .45));
        c += glow * pow(1. - h, 8.) * .55;
        gl_FragColor = vec4(c, 1.); }`,
  });
  return new THREE.Mesh(geo, mat);
}

function makeStars() {
  const n = 1500, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().randomDirection();
    v.y = Math.abs(v.y) * 0.9 + 0.08;
    v.normalize().multiplyScalar(280);
    pos.set([v.x, v.y, v.z], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xfff3d6, size: 1.1, sizeAttenuation: true, fog: false }));
}

// Simple two-storey façade so the scene works before the real model is added.
function buildPlaceholderFacade() {
  const group = new THREE.Group();
  const marble = new THREE.MeshStandardMaterial({ color: 0xe8dcc6, roughness: 0.7 });
  const shade = new THREE.MeshStandardMaterial({ color: 0x6b5a45, roughness: 0.9 });
  const box = (w, h, d, x, y, z, m = marble) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z); group.add(b); return b;
  };
  const column = (x, y, z, h, r) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r, h, 20), marble);
    c.position.set(x, y + h / 2, z); group.add(c);
    box(r * 2.6, 0.35, r * 2.6, x, y + h + 0.17, z);   // capital
    box(r * 2.4, 0.3, r * 2.4, x, y + 0.15, z);        // base
  };
  for (let i = 0; i < 9; i++) box(22 - i * 0.2, 0.2, 1.5 - i * 0.1, 0, 0.1 + i * 0.2, 4.6 - i * 0.12); // stairs
  box(22, 1.8, 4, 0, 0.9, 1.6);                          // podium
  box(21, 16, 1, 0, 8, -0.6);                             // back wall
  [-4.5, 0, 4.5].forEach((x, i) => box(i === 1 ? 2.6 : 2, i === 1 ? 5 : 4.2, 0.2, x, 1.8 + (i === 1 ? 2.5 : 2.1), -0.05, shade)); // doors
  const lower = [-9.5, -8.1, -4.9, -3.5, 3.5, 4.9, 8.1, 9.5];
  lower.forEach((x) => column(x, 1.8, 2.6, 6.2, 0.4));
  [[-9.5, -8.1], [-4.9, -3.5], [3.5, 4.9], [8.1, 9.5]].forEach(([a, b]) => box(b - a + 1.2, 1, 1.2, (a + b) / 2, 8.6, 2.4));
  const upper = [-6.7, -5.3, -0.7, 0.7, 5.3, 6.7];
  upper.forEach((x) => column(x, 9.1, 2.2, 5.2, 0.33));
  [[-6.7, -5.3], [-0.7, 0.7], [5.3, 6.7]].forEach(([a, b]) => box(b - a + 1.1, 0.9, 1.1, (a + b) / 2, 15.0, 2.0));
  [-6, 0, 6].forEach((x) => {
    const tri = new THREE.Shape([new THREE.Vector2(-1.3, 0), new THREE.Vector2(1.3, 0), new THREE.Vector2(0, 0.9)]);
    const p = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 1.1, bevelEnabled: false }), marble);
    p.position.set(x, 15.45, 1.45); group.add(p);
  });
  [-6.6, -2.2, 2.2, 6.6].forEach((x) => box(1.1, 2.6, 0.3, x, 4.2, -0.05, shade)); // statue niches
  return group;
}
