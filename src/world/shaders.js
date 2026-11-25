// Shared shader patches: moving cloud shadows, wind sway and the dithered fade at the edge of a scan.
import * as THREE from 'three';

export const uTime = { value: 0 };
export const uNoise = { value: makeNoiseTexture(256) };

// Tileable value-noise texture (red channel), used for clouds and edge breakup.
function makeNoiseTexture(size) {
  const data = new Uint8Array(size * size * 4);
  const layers = [[8, 0.5], [16, 0.27], [32, 0.15], [64, 0.08]];
  const grids = layers.map(([n]) => Array.from({ length: n * n }, () => Math.random()));
  const s = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0;
    layers.forEach(([n, amp], li) => {
      const g = grids[li], fx = (x / size) * n, fy = (y / size) * n;
      const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = s(fx - x0), ty = s(fy - y0);
      const at = (i, j) => g[((j % n) * n) + (i % n)];
      const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
      v += amp * (a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty);
    });
    const i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = Math.round(Math.min(1, v) * 255);
    data[i + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

const CLOUD_GLSL = `
uniform sampler2D uNoise;
float cloudShade(vec2 p) {
  vec2 uv = p * 0.0028 + uTime * vec2(0.0045, 0.0018);
  float n = texture2D(uNoise, uv).r * 0.7 + texture2D(uNoise, uv * 2.7 + 0.31).r * 0.3;
  return mix(1.0, 0.68, smoothstep(0.5, 0.66, n));
}`;

/**
 * Patch a built-in material.
 * opts.cloud  — darken under drifting cloud shadows
 * opts.wind   — { strength, height }: sway vertices, more towards the top (metres in model space)
 * opts.fade   — { center:[x,z], radius, width }: dissolve towards a ragged circle edge (world metres)
 * opts.dirt   — darken the lowest metre (model space), as weathered stone is
 * opts.extra  — function(shader) for material-specific changes, run last
 */
export function patchMaterial(material, opts = {}) {
  const key = JSON.stringify({ c: !!opts.cloud, w: !!opts.wind, f: !!opts.fade, d: !!opts.dirt, e: opts.key || '' });
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.uniforms.uNoise = uNoise;
    if (opts.wind) {
      sh.uniforms.uWind = { value: opts.wind.strength };
      sh.uniforms.uWindHeight = { value: opts.wind.height };
    }
    if (opts.fade) {
      sh.uniforms.uFadeCenter = { value: new THREE.Vector2(...opts.fade.center) };
      sh.uniforms.uFadeRadius = { value: opts.fade.radius };
      sh.uniforms.uFadeWidth = { value: opts.fade.width };
    }

    let head = 'uniform float uTime;\nvarying vec3 vWorld;\nvarying float vLocalY;\n';
    if (opts.wind) head += 'uniform float uWind; uniform float uWindHeight;\n';
    sh.vertexShader = head + sh.vertexShader;
    if (opts.wind) {
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  {
    float hgt = clamp(position.y / uWindHeight, 0.0, 1.5);
    vec2 ip = vec2(0.0);
    #ifdef USE_INSTANCING
      ip = instanceMatrix[3].xz;
    #endif
    float ph = dot(ip, vec2(0.13, 0.17)) + position.y * 0.15;
    float sway = sin(uTime * 1.05 + ph) * 0.65 + sin(uTime * 2.4 + ph * 1.7) * 0.25;
    transformed.x += sway * uWind * hgt * hgt;
    transformed.z += cos(uTime * 0.83 + ph) * 0.45 * uWind * hgt * hgt;
  }`);
    }
    sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
  {
    vec4 wp = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      wp = instanceMatrix * wp;
    #endif
    vWorld = (modelMatrix * wp).xyz;
    vLocalY = position.y;
  }`);

    let fhead = 'uniform float uTime;\nvarying vec3 vWorld;\nvarying float vLocalY;\n' + CLOUD_GLSL + '\n';
    if (opts.fade) fhead += 'uniform vec2 uFadeCenter; uniform float uFadeRadius; uniform float uFadeWidth;\n';
    sh.fragmentShader = fhead + sh.fragmentShader;

    let tail = '';
    if (opts.fade) tail += `
  {
    float d = distance(vWorld.xz, uFadeCenter);
    d += (texture2D(uNoise, vWorld.xz * 0.035).r - 0.5) * uFadeWidth * 1.4;
    float edge = smoothstep(uFadeRadius - uFadeWidth, uFadeRadius, d);
    float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    if (edge > ign) discard;
  }`;
    if (opts.dirt) tail += '\n  gl_FragColor.rgb *= mix(0.7, 1.0, smoothstep(0.0, 1.2, vLocalY));';
    if (opts.cloud) tail += '\n  gl_FragColor.rgb *= cloudShade(vWorld.xz);';
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', '#include <opaque_fragment>' + tail);

    if (opts.extra) opts.extra(sh);
  };
  material.customProgramCacheKey = () => key;
  material.needsUpdate = true;
  return material;
}
