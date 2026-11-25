// MetaOdyssey virtual museum: living ancient cities with a narrated tour, on desktop and in WebXR headsets.
// ?site=ephesus | sardis | aigai picks the city.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { addSky, addSun, addTerrain, addPaving } from './world/landscape.js';
import { addTrees, addGroundCover } from './world/vegetation.js';
import { addRuins } from './world/ruins.js';
import { addCity } from './world/city.js';
import { addPeople } from './world/people.js';
import { addBirds, addDust } from './world/life.js';
import { patchMaterial, uTime } from './world/shaders.js';
import { createAmbience } from './audio.js';
import { configureLayout } from './world/layout.js';
import { SITES, loadSite } from './sites/index.js';
import { createTour } from './tour.js';
import { createVrPanel } from './vr-panel.js';

const params = new URLSearchParams(location.search);
const site = await loadSite(params.get('site'));
configureLayout(site.layout);   // must run before anything is placed on the ground
// The museum is in English; ?lang=tr still opens the Turkish version.
let lang = params.get('lang') === 'tr' ? 'tr' : 'en';

// ---------- renderer, scene, camera ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
window.__scene = scene;
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 9000);
const rig = new THREE.Group();   // the visitor in VR; moved by teleporting and by the tour
rig.add(camera);
scene.add(rig);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 2;
controls.maxDistance = 260;

const manager = new THREE.LoadingManager();
const gltfLoader = new GLTFLoader(manager);
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

// ---------- world ----------
const ground = [];   // surfaces the VR visitor can teleport onto
const animators = [];
const ambience = createAmbience();

// The library can be shown as it was (modelled) or as it is today (the photogrammetry scan).
let ancient = null, today = null, ruins = null;
let era = params.get('era') === 'today' ? 'today' : 'ancient';
function setEra(e) {
  era = e;
  if (ancient) ancient.visible = era === 'ancient';
  if (today) today.visible = era === 'today';
  if (ruins) ruins.visible = era === 'today';
  const b = document.getElementById('era');
  if (b) b.hidden = !site.model;   // only sites with a scan of the ruin have a "today" view
  if (b) b.textContent = STRINGS[lang][era === 'ancient' ? 'showToday' : 'showAncient'];
}

async function buildWorld() {
  await addSky(scene, renderer, manager);
  addSun(scene, site.sun);
  ground.push(addTerrain(scene, manager, site.terrain));
  addPaving(scene, manager, site.paving);
  scene.traverse((o) => { if (o.name === 'paving') ground.push(o); });
  if (site.model) {   // ruined streets only go with a scan of the site today
    ruins = new THREE.Group();
    addRuins(ruins, manager);
    scene.add(ruins);
  }
  addTrees(scene);
  animators.push(addBirds(scene), addDust(scene));
  // the site's own monuments, as they stood in antiquity
  const built = site.build(scene, manager);
  ground.push(...built.walkable);
  ancient = new THREE.Group().add(built.group);
  if (site.stoas !== false) addCity(ancient, manager, site.stoas);
  scene.add(ancient);
  animators.push(addPeople(built.group, site.people), ...(built.animators || []));
  await Promise.all([site.model ? loadScan() : null, addGroundCover(scene, gltfLoader)]);
  setEra(era);
}

async function loadScan() {
  const gltf = await gltfLoader.loadAsync(site.model);
  const object = new THREE.Group().add(gltf.scene);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  object.scale.setScalar(site.fit.height / size.y);
  box.setFromObject(object);
  const c = box.getCenter(new THREE.Vector3());
  object.position.set(-c.x + site.offset[0], -box.min.y + site.offset[1], -c.z + site.offset[2]);
  object.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    for (const m of [].concat(o.material)) {
      m.toneMapped = false;   // keep the photographs' own colours
      patchMaterial(m, {
        fade: site.fade, cloud: true, key: 'scan',
        // the photos caught sky through the window openings: turn those blue pixels into a dark interior
        extra: (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
  { vec3 c = gl_FragColor.rgb;
    float sky = smoothstep(0.06, 0.16, c.b - max(c.r, c.g * 0.92)) * smoothstep(0.12, 0.3, c.b);
    gl_FragColor.rgb = mix(c, vec3(0.03, 0.025, 0.02), sky); }`); },
      });
    }
  });
  today = new THREE.Group().add(object, makeHall(site.hall));
  scene.add(today);
  window.__scan = object;   // handy for inspecting from the console
}

// The reading hall behind the façade, so its windows and door show a dark interior instead of sky.
function makeHall([x0, x1, z0, z1, h]) {
  const geo = new THREE.BoxGeometry(x1 - x0, h, z1 - z0).translate((x0 + x1) / 2, h / 2, (z0 + z1) / 2);
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  const outside = patchMaterial(new THREE.MeshStandardMaterial({ color: 0xb09a7e, roughness: 0.95 }), { cloud: true, key: 'hall' });
  const inside = new THREE.MeshStandardMaterial({ color: 0x6b5a48, roughness: 1, side: THREE.BackSide, envMapIntensity: 0.35 });
  // roofless, like the real ruin; the front face is left open for the façade
  const shell = new THREE.Mesh(geo, [outside, outside, hidden, outside, hidden, outside]);
  const t = 0.12;   // wall thickness
  const inner = new THREE.BoxGeometry(x1 - x0 - 2 * t, h, z1 - z0 - 2 * t).translate((x0 + x1) / 2, h / 2, (z0 + z1) / 2);
  const room = new THREE.Mesh(inner, [inside, inside, hidden, inside, hidden, inside]);
  shell.castShadow = true;
  room.receiveShadow = true;
  return new THREE.Group().add(shell, room);
}

// ---------- tour (desktop camera + narration) ----------
const ui = {
  intro: document.getElementById('intro'),
  start: document.getElementById('start'),
  explore: document.getElementById('explore'),
  chapters: document.getElementById('chapters'),
  caption: document.getElementById('caption'),
  captionTitle: document.getElementById('caption-title'),
  captionText: document.getElementById('caption-text'),
  controls: document.getElementById('controls'),
  play: document.getElementById('play'),
  prev: document.getElementById('prev'),
  next: document.getElementById('next'),
  sound: document.getElementById('sound'),
};

window.__camera = camera; window.__controls = controls;
const vrPanel = createVrPanel();
vrPanel.setChapters(site.chapters);
const tour = createTour({
  site, camera, controls, rig, renderer,
  getLang: () => lang,
  isMuted: () => ambience.muted,
  onChange: (state) => {
    // some chapters are about the ruin as it stands today
    const ch = site.chapters[state.index];
    if (ch && ch.era && ch.era !== era) setEra(ch.era);
    renderUi(state); vrPanel.update(state, lang);
  },
});

const STRINGS = {
  en: { start: 'Start the tour', explore: 'Explore freely', loading: 'Loading', sound: 'Sound', mute: 'Muted', credits: 'Credits', showToday: 'See it today', showAncient: 'See it in AD 120', end: 'Explore freely: drag to look around, scroll to zoom.', eyebrow: 'MetaOdyssey · Virtual Museum' },
  tr: { start: 'Turu başlat', explore: 'Serbest gez', loading: 'Yükleniyor', sound: 'Ses', mute: 'Sessiz', credits: 'Kaynaklar', showToday: 'Bugünkü hâli', showAncient: 'MS 120’deki hâli', end: 'Serbest gezinti: sürükleyerek etrafa bak, tekerlekle yaklaş.', eyebrow: 'MetaOdyssey · Sanal Müze' },
};

function renderUi(state) {
  const s = STRINGS[lang];
  ui.chapters.innerHTML = site.chapters.map((ch, i) =>
    `<button class="${i === state.index ? 'on' : ''}" data-i="${i}"><span>${String(i + 1).padStart(2, '0')}</span>${ch.title[lang]}</button>`).join('');
  ui.chapters.querySelectorAll('button').forEach((b) => { b.onclick = () => { startAudio(); tour.goTo(+b.dataset.i, true); }; });
  const ch = site.chapters[state.index];
  ui.captionTitle.textContent = state.index >= 0 ? ch.title[lang] : '';
  ui.captionText.textContent = state.ended ? s.end : state.sentence || '';
  ui.play.textContent = state.playing ? '❚❚' : '▶';
  document.getElementById('next-city').hidden = !(state.ended || state.index === site.chapters.length - 1);
  ui.play.setAttribute('aria-label', state.playing ? 'Pause' : 'Play');
  ui.sound.textContent = ambience.muted ? s.mute : s.sound;
  ui.sound.classList.toggle('off', ambience.muted);
}

// city tabs on the intro screen and in the header; each city is its own page (?site=...)
const cityUrl = (id) => `?site=${id}${lang === 'tr' ? '&lang=tr' : ''}`;
const cityTabs = SITES.map((c) => `<a href="${cityUrl(c.id)}" class="${c.id === site.id ? 'on' : ''}">${c.city[lang]}</a>`).join('');
document.getElementById('cities').innerHTML = cityTabs;
document.getElementById('city-switch').innerHTML = cityTabs;
// on the last chapter, offer the next city
const nextSite = SITES[(SITES.findIndex((c) => c.id === site.id) + 1) % SITES.length];
const nextCity = document.getElementById('next-city');
nextCity.href = cityUrl(nextSite.id);
nextCity.textContent = `${nextSite.city[lang]} →`;
vrPanel.setNextCity(nextSite.city[lang]);

function applyLang() {
  const s = STRINGS[lang];
  document.documentElement.lang = lang;
  document.getElementById('eyebrow').textContent = s.eyebrow;
  document.getElementById('intro-title').textContent = site.city[lang];
  document.getElementById('intro-sub').textContent = site.place[lang];
  document.getElementById('where').textContent = `${site.city[lang]} · ${site.place[lang]}`;
  ui.explore.textContent = s.explore;
  if (!ui.start.disabled) ui.start.textContent = s.start;
  document.getElementById('credits-btn').textContent = s.credits;
  setEra(era);
  document.querySelectorAll('[data-lang]').forEach((b) => b.classList.toggle('on', b.dataset.lang === lang));
  document.title = `MetaOdyssey · ${site.city[lang]}`;
  renderUi(tour.state);
}

function startAudio() { ambience.start(); }

function enterTour(play) {
  startAudio();
  ui.intro.classList.add('gone');
  document.body.classList.add('touring');
  ui.chapters.hidden = ui.caption.hidden = ui.controls.hidden = false;
  if (play) tour.goTo(0, true);
  else tour.explore();
}

ui.start.onclick = () => enterTour(true);
ui.explore.onclick = () => enterTour(false);
ui.play.onclick = () => { startAudio(); tour.toggle(); };
ui.prev.onclick = () => tour.goTo(Math.max(0, tour.state.index - 1), true);
ui.next.onclick = () => tour.goTo(Math.min(site.chapters.length - 1, tour.state.index + 1), true);
ui.sound.onclick = () => { ambience.setMuted(!ambience.muted); tour.refreshVoice(); renderUi(tour.state); };
document.querySelectorAll('[data-lang]').forEach((b) => { b.onclick = () => { lang = b.dataset.lang; applyLang(); tour.refreshVoice(); }; });
document.getElementById('era').onclick = () => setEra(era === 'ancient' ? 'today' : 'ancient');
document.getElementById('credits-btn').onclick = () => { document.getElementById('credits').hidden = false; };
document.querySelector('[data-close="credits"]').onclick = () => { document.getElementById('credits').hidden = true; };
document.getElementById('credits-body').innerHTML = site.credits.map((c) =>
  `<p><a href="${c.url}" target="_blank" rel="noopener">${c.work}</a> · ${c.author} · ${c.license}</p>`).join('') +
  '<p>Columns, trees, birds and sound are generated in the browser. Built with three.js.</p>' +
  '<p>MetaOdyssey · Erasmus+ 2025-3-TR01-KA152-YOU-000382053</p>';

let failed = false;
manager.onProgress = (url, loaded, total) => {
  if (ui.start.disabled && !failed) ui.start.textContent = `${STRINGS[lang].loading} ${Math.round((loaded / total) * 100)}%`;
};

// ---------- VR ----------
// "Enter VR" buttons appear only where a headset can actually be used (e.g. the Quest browser).
async function setupVrButtons() {
  if (!navigator.xr || !(await navigator.xr.isSessionSupported('immersive-vr').catch(() => false))) return;
  let session = null;
  for (const b of document.querySelectorAll('.vr-btn')) {
    b.hidden = false;
    b.onclick = async () => {
      if (session) { session.end(); return; }
      session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
      session.addEventListener('end', () => { session = null; });
      await renderer.xr.setSession(session);
    };
  }
}
setupVrButtons();

const raycaster = new THREE.Raycaster();
const tempMatrix = new THREE.Matrix4();
const marker = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 40).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, toneMapped: false, depthTest: false }));
marker.visible = false;
marker.renderOrder = 10;
scene.add(marker);

const modelFactory = new XRControllerModelFactory();
const controllers = [0, 1].map((i) => {
  const ctrl = renderer.xr.getController(i);
  const ray = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
  ray.scale.z = 12;
  ctrl.add(ray);
  ctrl.userData.ray = ray;
  ctrl.addEventListener('selectend', () => onVrSelect(ctrl));
  rig.add(ctrl);
  const grip = renderer.xr.getControllerGrip(i);
  grip.add(modelFactory.createControllerModel(grip));
  rig.add(grip);
  return ctrl;
});

function aim(ctrl) {
  tempMatrix.identity().extractRotation(ctrl.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(ctrl.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
}

function onVrSelect(ctrl) {
  aim(ctrl);
  const action = vrPanel.hit(raycaster);
  if (action === 'none') return;
  if (action) {
    startAudio();
    if (action === 'prev') tour.goTo(Math.max(0, tour.state.index - 1), true);
    if (action === 'next') tour.goTo(Math.min(site.chapters.length - 1, tour.state.index + 1), true);
    if (action === 'play') tour.toggle();
    if (action === 'city') {
      // leave the headset view, then load the next city (re-enter VR there with the VR button)
      const go = () => { location.href = cityUrl(nextSite.id); };
      const session = renderer.xr.getSession();
      if (session) session.end().then(go, go); else go();
    }
    return;
  }
  const hit = raycaster.intersectObjects(ground, false)[0];
  if (hit && hit.distance < 40) {
    const head = camera.getWorldPosition(new THREE.Vector3());
    tour.fadeThen(() => {
      rig.position.x += hit.point.x - head.x;
      rig.position.z += hit.point.z - head.z;
      rig.position.y = hit.point.y;
    });
  }
}

function updateVrAim() {
  marker.visible = false;
  for (const ctrl of controllers) {
    aim(ctrl);
    const onPanel = vrPanel.hover(raycaster);
    if (onPanel) continue;
    const hit = raycaster.intersectObjects(ground, false)[0];
    if (hit && hit.distance < 40) {
      marker.position.copy(hit.point).add(new THREE.Vector3(0, 0.03, 0));
      marker.visible = true;
    }
  }
}

renderer.xr.addEventListener('sessionstart', () => {
  // headsets have far less GPU: thin out grass and shrubs while in VR
  scene.traverse((o) => { if (o.userData.thinInVr) { o.userData.fullCount ??= o.count; o.count = Math.floor(o.userData.fullCount * 0.4); } });
  startAudio();
  ui.intro.classList.add('gone');
  tour.enterVr();
  rig.add(vrPanel.mesh);
  if (tour.state.index < 0) tour.goTo(0, true);
});
renderer.xr.addEventListener('sessionend', () => {
  scene.traverse((o) => { if (o.userData.fullCount) o.count = o.userData.fullCount; });
  rig.remove(vrPanel.mesh);
  tour.exitVr();
  ui.chapters.hidden = ui.caption.hidden = ui.controls.hidden = false;
});

// ---------- loop ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;
  uTime.value = t;
  for (const a of animators) a(t);
  tour.update(dt, t);
  if (renderer.xr.isPresenting) updateVrAim();
  else controls.update();
  renderer.render(scene, camera);
});

// The intro shows a slow aerial view while everything loads.
tour.preview();
applyLang();
buildWorld().then(() => {
  ui.start.disabled = false;
  ui.start.textContent = STRINGS[lang].start;
  document.body.classList.add('ready');
}).catch((e) => {
  console.error(e);
  failed = true;
  ui.start.textContent = 'Error: ' + e.message;
});

