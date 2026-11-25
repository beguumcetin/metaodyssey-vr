// Things that move on their own: swallows circling over the site and dust drifting in the sunlight.
import * as THREE from 'three';
import { rng } from './noise.js';

function birdGeometry() {
  // body plus two wings; the wing vertices are tagged (side = ±1) so the shader can flap them
  const pos = [
    // body
    0, 0, 0.32, -0.05, 0, -0.1, 0.05, 0, -0.1,
    0, 0, 0.32, 0.05, 0, -0.1, 0, 0.03, -0.05,
    // left wing
    -0.04, 0, 0.1, -0.04, 0, -0.08, -0.55, 0, -0.18,
    // right wing
    0.04, 0, 0.1, 0.55, 0, -0.18, 0.04, 0, -0.08,
    // forked tail
    -0.03, 0, -0.1, -0.12, 0, -0.42, 0, 0, -0.16,
    0.03, 0, -0.1, 0, 0, -0.16, 0.12, 0, -0.42,
  ];
  const side = [0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 0];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('side', new THREE.Float32BufferAttribute(side, 1));
  g.computeVertexNormals();
  return g;
}

export function addBirds(scene) {
  const rand = rng(51);
  const flocks = [
    { center: new THREE.Vector3(-10, 34, 25), radius: 38, speed: 0.22, count: 16 },
    { center: new THREE.Vector3(60, 52, -40), radius: 55, speed: -0.16, count: 12 },
  ];
  const total = flocks.reduce((n, f) => n + f.count, 0);
  const mat = new THREE.MeshBasicMaterial({ color: 0x23211f, side: THREE.DoubleSide, fog: true });
  const flap = { value: 0 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uFlap = flap;
    sh.vertexShader = 'attribute float side;\nattribute float phase;\nuniform float uFlap;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       { float w = sin(uFlap * 14.0 + phase) * 0.85;
         if (side != 0.0) transformed.y += abs(transformed.x) * w; }`);
  };
  const geo = birdGeometry();
  const mesh = new THREE.InstancedMesh(geo, mat, total);
  const phases = new Float32Array(total);
  const birds = [];
  for (const f of flocks) for (let i = 0; i < f.count; i++) {
    phases[birds.length] = rand() * 6.28;
    birds.push({ f, a: rand() * 6.28, r: f.radius * (0.6 + rand() * 0.6), h: (rand() - 0.5) * 10, w: 0.8 + rand() * 0.4, s: 1.6 + rand() * 0.8, k: rand() * 10 });
  }
  geo.setAttribute('phase', new THREE.InstancedBufferAttribute(phases, 1));
  mesh.frustumCulled = false;
  scene.add(mesh);

  const m = new THREE.Matrix4(), p = new THREE.Vector3(), next = new THREE.Vector3(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const pos = (b, t, out) => {
    const a = b.a + t * b.f.speed * b.w;
    const wobble = Math.sin(t * 0.7 + b.k) * 0.25;
    return out.set(
      b.f.center.x + Math.cos(a) * b.r * (1 + wobble),
      b.f.center.y + b.h + Math.sin(t * 0.9 + b.k) * 3,
      b.f.center.z + Math.sin(a) * b.r * (1 - wobble * 0.5));
  };
  return (t) => {
    flap.value = t;
    birds.forEach((b, i) => {
      pos(b, t, p);
      pos(b, t + 0.05, next);
      m.lookAt(next, p, up);
      q.setFromRotationMatrix(m);
      m.compose(p, q, new THREE.Vector3(b.s, b.s, b.s));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
}

function softDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function addDust(scene) {
  const rand = rng(61), n = 700;
  const base = new Float32Array(n * 3), pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) base.set([(rand() - 0.5) * 34, 0.3 + rand() * 12, 2 + rand() * 26], i * 3);
  pos.set(base);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.05, map: softDot(), color: 0xffe2b0, transparent: true, opacity: 0.55,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  const points = new THREE.Points(g, mat);
  points.frustumCulled = false;
  scene.add(points);
  return (t) => {
    for (let i = 0; i < n; i++) {
      const k = i * 3, ph = i * 0.37;
      pos[k] = base[k] + Math.sin(t * 0.13 + ph) * 1.2;
      pos[k + 1] = base[k + 1] + Math.sin(t * 0.21 + ph * 1.3) * 0.6;
      pos[k + 2] = base[k + 2] + Math.cos(t * 0.11 + ph * 0.7) * 1.2;
    }
    g.attributes.position.needsUpdate = true;
  };
}
