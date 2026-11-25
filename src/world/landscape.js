// Sky dome, image-based light, sun, terrain and paved surfaces.
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { heightAt, grassAt, PLAZA, STREETS, streetLength, streetPoint, streetHeight } from './layout.js';
import { patchMaterial } from './shaders.js';

// Direction of the sun in the sky photo (Poly Haven "kloofendal_48d_partly_cloudy_puresky").
export const SUN_DIR = new THREE.Vector3(0.471, 0.804, 0.364).normalize();
export const HAZE = new THREE.Color(0xa7adbd);

export async function addSky(scene, renderer, manager) {
  const tex = await new THREE.TextureLoader(manager).loadAsync('assets/sky/sky.jpg');
  tex.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(4500, 64, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
      uniforms: { uSky: { value: tex }, uHaze: { value: HAZE.clone().convertSRGBToLinear() } },
      vertexShader: `varying vec3 vDir;
        void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: `uniform sampler2D uSky; uniform vec3 uHaze; varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          vec2 uv = vec2(atan(d.z, d.x) * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5);
          vec3 c = texture2D(uSky, uv).rgb;
          c = mix(uHaze, c, smoothstep(-0.02, 0.06, d.y));
          gl_FragColor = linearToOutputTexel(vec4(c, 1.0));
        }`,
    }));
  dome.renderOrder = -1;
  dome.frustumCulled = false;
  dome.onBeforeRender = (r, s, cam) => dome.position.copy(cam.getWorldPosition(new THREE.Vector3()));
  scene.add(dome);

  const hdr = await new RGBELoader(manager).loadAsync('assets/sky/sky_1k.hdr');
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(hdr).texture;
  hdr.dispose();
  pmrem.dispose();
  scene.fog = new THREE.FogExp2(HAZE, 0.00042);
}

// opts.center / opts.extent: the area that gets sharp shadows (the main monument)
export function addSun(scene, opts = {}) {
  const [cx, cy, cz] = opts.center || [0, 0, 8], ext = opts.extent || 55;
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.9);
  sun.target.position.set(cx, cy, cz);
  sun.position.copy(SUN_DIR).multiplyScalar(120 + ext).add(sun.target.position);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const c = sun.shadow.camera;
  c.left = -ext; c.right = ext; c.top = ext; c.bottom = -ext; c.near = 10; c.far = 300 + ext * 2;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x6a5a46, 0.15));
  return sun;
}

function loadTex(loader, name, repeat, srgb) {
  const t = loader.load(`assets/tex/${name}.jpg`);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.repeat.set(repeat, repeat);
  return t;
}

// Terrain on rings that get wider with distance: fine near the library, coarse on far mountains.
function ringGeometry() {
  const radii = [0];
  for (let r = 1.5; r < 70; r += 1.5) radii.push(r);
  for (let r = 70; r < 2900; r *= 1.045) radii.push(r);
  const seg = 192;
  const pos = [], uv = [], grass = [], index = [];
  for (const r of radii) {
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      pos.push(x, heightAt(x, z), z);
      uv.push(x / 6, z / 6);
      grass.push(grassAt(x, z));
    }
  }
  const row = seg + 1;
  for (let i = 0; i < radii.length - 1; i++) for (let j = 0; j < seg; j++) {
    const a = i * row + j, b = a + 1, c = a + row, d = c + 1;
    index.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('grass', new THREE.Float32BufferAttribute(grass, 1));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

export function addTerrain(scene, manager, opts = {}) {
  const cliff = new THREE.Color(opts.cliff ?? 0x8c7a62);   // bare rock on steep slopes
  const loader = new THREE.TextureLoader(manager);
  const dirt = loadTex(loader, 'dry_ground_rocks_diff', 0, true);
  const dirtN = loadTex(loader, 'dry_ground_rocks_nor');
  const grass = loadTex(loader, 'aerial_grass_rock_diff', 0, true);
  const mat = new THREE.MeshStandardMaterial({ map: dirt, normalMap: dirtN, roughness: 0.96, metalness: 0 });
  mat.normalScale.set(0.8, 0.8);
  patchMaterial(mat, {
    cloud: true, key: 'terrain',
    extra: (sh) => {
      sh.uniforms.uGrass = { value: grass };
      sh.uniforms.uCliff = { value: cliff };
      sh.vertexShader = 'attribute float grass;\nvarying float vGrass;\nvarying float vUp;\n' + sh.vertexShader.replace(
        '#include <uv_vertex>', '#include <uv_vertex>\n  vGrass = grass;\n  vUp = normal.y;');
      sh.fragmentShader = 'uniform sampler2D uGrass;\nuniform vec3 uCliff;\nvarying float vGrass;\nvarying float vUp;\n' + sh.fragmentShader.replace(
        '#include <map_fragment>',
        `{
          float dist = distance(vWorld, cameraPosition);
          vec4 near = texture2D(map, vMapUv);
          vec4 far = texture2D(map, vMapUv * 0.17 + 0.37);
          vec4 g1 = texture2D(uGrass, vMapUv * 0.5);
          vec4 g2 = texture2D(uGrass, vMapUv * 0.09 + 0.21);
          float farMix = smoothstep(15.0, 120.0, dist);
          vec4 ground = mix(mix(near, far, 0.35), far, farMix);
          vec4 green = mix(g1, g2, 0.4 + 0.4 * farMix) * vec4(0.72, 0.78, 0.62, 1.0);
          float macro = texture2D(uNoise, vWorld.xz * 0.0011).r;
          float g = clamp(vGrass + (macro - 0.5) * 0.5, 0.0, 1.0);
          vec4 col = mix(ground, green, g);
          // distant slopes read as maquis and pine: darker, greener
          float patchy = texture2D(uNoise, vWorld.xz * 0.006 + 0.5).r * 0.6 + texture2D(uNoise, vWorld.xz * 0.03).r * 0.4;
          float forest = smoothstep(0.32, 0.6, patchy) * smoothstep(35.0, 140.0, length(vWorld.xz));
          vec3 maquis = mix(vec3(0.045, 0.06, 0.025), vec3(0.11, 0.12, 0.06), texture2D(uNoise, vWorld.xz * 0.08).r);
          col.rgb = mix(col.rgb * vec3(0.85, 0.85, 0.8), maquis, forest * 0.85);
          // steep ground is bare, eroded rock with darker gullies
          float steep = smoothstep(0.82, 0.62, vUp);
          float gully = texture2D(uNoise, vec2(vWorld.x * 0.05, vWorld.y * 0.02)).r;
          col.rgb = mix(col.rgb, uCliff * mix(0.7, 1.15, gully) * (0.85 + 0.3 * near.r), steep);
          diffuseColor *= col;
        }`);
    },
  });
  const mesh = new THREE.Mesh(ringGeometry(), mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  scene.add(mesh);
  return mesh;
}

// Marble paving: the square in front of the library and the two colonnaded streets.
export function addPaving(scene, manager, opts = {}) {
  const loader = new THREE.TextureLoader(manager);
  const map = loadTex(loader, 'marble_01_diff', 0, true);
  const nor = loadTex(loader, 'marble_01_nor');
  const rough = loadTex(loader, 'marble_01_rough');
  const mat = new THREE.MeshStandardMaterial({ map, normalMap: nor, roughnessMap: rough, roughness: 1, color: 0xe6ddcc });
  patchMaterial(mat, {
    cloud: true, key: 'paving',
    extra: (sh) => {
      // Break the edges of the paving up so it ends in the dirt instead of a straight line.
      sh.vertexShader = 'attribute float edge;\nvarying float vEdge;\n' + sh.vertexShader.replace(
        '#include <uv_vertex>', '#include <uv_vertex>\n  vEdge = edge;');
      sh.fragmentShader = 'varying float vEdge;\n' + sh.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          float n = texture2D(uNoise, vWorld.xz * 0.09).r;
          if (vEdge > 0.55 + n * 0.5) discard;
          float worn = texture2D(uNoise, vWorld.xz * 0.02 + 0.3).r;
          diffuseColor.rgb *= mix(0.78, 1.04, worn) * mix(1.0, 0.82, vEdge);
        }`);
    },
  });
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -1;

  const parts = [];
  // square
  if (opts.square !== false) parts.push(gridPatch(PLAZA.minX - 3, PLAZA.maxX + 3, PLAZA.minZ, PLAZA.maxZ + 3, 1.2, (x, z) => {
    const ex = Math.max(PLAZA.minX - x, x - PLAZA.maxX, 0) / 3;
    const ez = Math.max(z - PLAZA.maxZ, 0) / 3;
    return Math.min(1, Math.max(ex, ez));
  }));
  // streets
  for (const s of STREETS) parts.push(streetStrip(s));
  for (const g of parts) {
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    m.name = 'paving';
    scene.add(m);
  }
  return parts;
}

function gridPatch(x0, x1, z0, z1, step, edgeFn) {
  const nx = Math.ceil((x1 - x0) / step), nz = Math.ceil((z1 - z0) / step);
  const pos = [], uv = [], edge = [], index = [];
  for (let i = 0; i <= nz; i++) for (let j = 0; j <= nx; j++) {
    const x = x0 + (j / nx) * (x1 - x0), z = z0 + (i / nz) * (z1 - z0);
    pos.push(x, heightAt(x, z) + 0.1, z);
    uv.push(x / 3.4, z / 3.4);
    edge.push(edgeFn(x, z));
  }
  for (let i = 0; i < nz; i++) for (let j = 0; j < nx; j++) {
    const a = i * (nx + 1) + j, b = a + 1, c = a + nx + 1, d = c + 1;
    index.push(a, c, b, b, c, d);
  }
  return finish(pos, uv, edge, index);
}

function streetStrip(street) {
  const len = streetLength(street);
  const half = street.width / 2 + 1.5, across = 8;
  const pos = [], uv = [], edge = [], index = [];
  const steps = Math.ceil(len / 1.5);
  for (let i = 0; i <= steps; i++) {
    const s = (i / steps) * len;
    const p = streetPoint(street, s);
    const nx = -p.dir[1], nz = p.dir[0];
    const y = streetHeight(street, s);
    for (let k = 0; k <= across; k++) {
      const t = (k / across) * 2 - 1;
      const x = p.x + nx * t * half, z = p.z + nz * t * half;
      pos.push(x, Math.max(y - 0.02, heightAt(x, z) + 0.1), z);
      uv.push((t * half) / 3.4, s / 3.4);
      edge.push(Math.max(smoothstep01((Math.abs(t) * half - (half - 2.2)) / 2.2), smoothstep01((s - (len - 25)) / 25)));
    }
  }
  for (let i = 0; i < steps; i++) for (let k = 0; k < across; k++) {
    const a = i * (across + 1) + k, b = a + 1, c = a + across + 1, d = c + 1;
    index.push(a, b, c, b, d, c);
  }
  return finish(pos, uv, edge, index);
}

const smoothstep01 = (t) => { t = Math.min(Math.max(t, 0), 1); return t * t * (3 - 2 * t); };

function finish(pos, uv, edge, index) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('edge', new THREE.Float32BufferAttribute(edge, 1));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}
