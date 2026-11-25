// A small panel floating in front of the visitor in VR: chapter title, the current subtitle and three buttons.
import * as THREE from 'three';

const W = 1024, H = 420;
const BUTTONS = [
  { id: 'prev', x: 312, label: '‹' },
  { id: 'play', x: 512, label: '' },
  { id: 'next', x: 712, label: '›' },
];
const BTN_Y = 350, BTN_R = 46;

export function createVrPanel() {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9 * H / W),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, fog: false, depthTest: false }));
  mesh.renderOrder = 20;
  mesh.position.set(0, 0.92, -1.05);
  mesh.rotation.x = -0.42;
  let last = null, lastLang = 'en', hovered = null;

  function wrap(text, x, y, maxW, lineH, maxLines) {
    const words = text.split(' ');
    let line = '', n = 0;
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (g.measureText(test).width > maxW && line) {
        g.fillText(line, x, y + n * lineH);
        line = w;
        if (++n >= maxLines) return;
      } else line = test;
    }
    g.fillText(line, x, y + n * lineH);
  }

  function draw() {
    const s = last || { index: -1, playing: false, sentence: '' };
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(14,14,16,0.72)';
    g.beginPath();
    g.roundRect(4, 4, W - 8, H - 8, 36);
    g.fill();
    g.textAlign = 'center';
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.font = '500 26px "Instrument Sans", sans-serif';
    const total = mesh.userData.total || 0;
    g.fillText(s.index >= 0 ? `${s.index + 1} / ${total}   ·   ${mesh.userData.titles?.[s.index]?.[lastLang] || ''}` : '', W / 2, 62);
    g.fillStyle = '#fff';
    g.font = '400 36px "Instrument Sans", sans-serif';
    wrap(s.sentence || '', W / 2, 122, W - 120, 46, 4);
    for (const b of BUTTONS) {
      g.fillStyle = hovered === b.id ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.16)';
      g.beginPath();
      g.arc(b.x, BTN_Y, BTN_R, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = hovered === b.id ? '#111' : '#fff';
      if (b.id === 'play') {
        if (s.playing) { g.fillRect(b.x - 14, BTN_Y - 17, 9, 34); g.fillRect(b.x + 5, BTN_Y - 17, 9, 34); }
        else { g.beginPath(); g.moveTo(b.x - 10, BTN_Y - 19); g.lineTo(b.x + 18, BTN_Y); g.lineTo(b.x - 10, BTN_Y + 19); g.fill(); }
      } else {
        g.font = '300 64px "Instrument Sans", sans-serif';
        g.fillText(b.label, b.x, BTN_Y + 20);
      }
    }
    tex.needsUpdate = true;
  }

  function buttonAt(raycaster) {
    const hit = raycaster.intersectObject(mesh, false)[0];
    if (!hit) return null;
    const x = hit.uv.x * W, y = (1 - hit.uv.y) * H;
    return BUTTONS.find((b) => Math.hypot(x - b.x, y - BTN_Y) < BTN_R * 1.3)?.id || 'panel';
  }

  draw();
  return {
    mesh,
    setChapters(chapters) {
      mesh.userData.total = chapters.length;
      mesh.userData.titles = chapters.map((c) => c.title);
      draw();
    },
    update(state, lang) { last = state; lastLang = lang; if (mesh.parent) draw(); },
    hover(raycaster) {
      if (!mesh.parent) return false;
      const b = buttonAt(raycaster);
      const h = b && b !== 'panel' ? b : null;
      if (h !== hovered) { hovered = h; draw(); }
      return !!b;
    },
    hit(raycaster) {
      if (!mesh.parent) return null;
      const b = buttonAt(raycaster);
      return b === 'panel' ? 'none' : b;
    },
  };
}
