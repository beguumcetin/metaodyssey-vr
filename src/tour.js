// The guided tour: moves the camera (desktop) or the visitor (VR) between chapters and narrates each one.
import * as THREE from 'three';
import { heightAt } from './world/layout.js';

const ease = (t) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(Math.max(t, 0), 1));

export function createTour({ site, camera, controls, rig, renderer, getLang, isMuted, onChange }) {
  const state = { index: -1, playing: false, sentence: '', ended: false };
  let move = null;          // camera flight in progress
  let narration = null;     // sentences being spoken
  let token = 0;            // invalidates callbacks from an older chapter
  let previewing = false, inVr = false, arrival = null, now = 0;
  const emit = () => onChange({ ...state });

  // ---------- black fade (used in VR so moving never makes anyone dizzy) ----------
  const fadeMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false, fog: false, toneMapped: false });
  const fadeSphere = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), fadeMat);
  fadeSphere.renderOrder = 999;
  fadeSphere.visible = false;
  camera.add(fadeSphere);
  let fade = null;
  function fadeThen(fn) { fade = { t: 0, fn, done: false }; fadeSphere.visible = true; }
  function updateFade(dt) {
    if (!fade) return;
    fade.t += dt;
    if (fade.t < 0.25) fadeMat.opacity = fade.t / 0.25;
    else {
      if (!fade.done) { fade.done = true; fade.fn(); }
      fadeMat.opacity = Math.max(0, 1 - (fade.t - 0.35) / 0.4);
      if (fade.t > 0.75) { fade = null; fadeSphere.visible = false; }
    }
  }

  // ---------- narration ----------
  const voiceFor = (lang) => {
    if (!('speechSynthesis' in window)) return null;
    const voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang));
    const preferred = lang === 'tr' ? ['Yelda', 'Google Türkçe'] : ['Daniel', 'Google UK English Male', 'Samantha', 'Google US English'];
    return voices.find((v) => preferred.some((p) => v.name.includes(p))) || voices[0] || null;
  };
  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => {};

  // Recorded narration (e.g. made with ElevenLabs) lives at assets/voice/<lang>/<01..>.mp3, one file per chapter.
  // When a file exists it is played instead of the browser's speech voice.
  const recordings = {};
  const audio = new Audio();
  audio.preload = 'auto';
  async function recordingFor(lang, i) {
    const key = `${lang}/${i}`;
    if (!(key in recordings)) {
      const url = `assets/voice/${lang}/${String(i + 1).padStart(2, '0')}.mp3`;
      recordings[key] = fetch(url, { method: 'HEAD' }).then((r) => (r.ok ? url : null)).catch(() => null);
    }
    return recordings[key];
  }

  function playRecording(id, url) {
    const sentences = narration.sentences;
    // subtitles follow the audio: each sentence gets a share of the time in proportion to its length
    const total = sentences.reduce((a, s) => a + s.length, 0);
    const ends = [];
    sentences.reduce((a, s) => { ends.push((a + s.length) / total); return a + s.length; }, 0);
    audio.src = url;
    audio.currentTime = 0;
    audio.ontimeupdate = () => {
      if (!narration || narration.id !== id || !audio.duration) return;
      const f = audio.currentTime / audio.duration;
      const k = Math.min(ends.findIndex((e) => f < e + 0.01), sentences.length - 1);
      const text = sentences[k < 0 ? sentences.length - 1 : k];
      if (text !== state.sentence) { state.sentence = text; emit(); }
    };
    audio.onended = () => {
      if (!narration || narration.id !== id) return;
      narration.done = true;
      narration.doneAt = now;
    };
    state.sentence = sentences[0];
    emit();
    audio.play().catch(() => speak(id));   // autoplay blocked or file broken: fall back to speech
  }

  const sentencesOf = (i) => site.chapters[i].text[getLang()].split(/(?<=[.!?])\s+/);

  function stopVoice() {
    if (narration) { clearTimeout(narration.timer); clearTimeout(narration.safety); }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    audio.pause();
    audio.ontimeupdate = audio.onended = null;
  }

  function startNarration(i, delay) {
    stopVoice();
    const id = ++token;
    narration = { id, sentences: sentencesOf(i), i: 0, done: false, doneAt: 0 };
    const ready = recordingFor(getLang(), i);
    narration.timer = setTimeout(async () => {
      const url = await ready;
      if (!narration || narration.id !== id || !state.playing) return;
      if (url && !isMuted()) playRecording(id, url);
      else speak(id);
    }, delay * 1000);
  }

  function speak(id) {
    if (!narration || narration.id !== id || !state.playing) return;
    if (narration.i >= narration.sentences.length) {
      narration.done = true;
      narration.doneAt = now;
      return;
    }
    const text = narration.sentences[narration.i];
    state.sentence = text;
    emit();
    const words = text.split(/\s+/).length;
    const advance = () => {
      if (!narration || narration.id !== id) return;
      clearTimeout(narration.safety);
      narration.i++;
      narration.timer = setTimeout(() => speak(id), 350);
    };
    const voice = !isMuted() && voiceFor(getLang());
    if (voice) {
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = 0.95;
      u.onend = advance;
      u.onerror = advance;
      speechSynthesis.speak(u);
      narration.safety = setTimeout(advance, (words * 0.6 + 4) * 1000);
    } else {
      narration.timer = setTimeout(advance, (words * 0.36 + 1.4) * 1000);
    }
  }

  // ---------- camera ----------
  const v = (a) => new THREE.Vector3(...a);

  function flyTo(ch) {
    const p0 = camera.position.clone(), t0 = controls.target.clone();
    const p1 = v(ch.camera.position), t1 = v(ch.camera.target);
    const pts = [p0], tgs = [t0];
    if (ch.from && p0.distanceTo(p1) > 60) { pts.push(v(ch.from.position)); tgs.push(v(ch.from.target)); }
    pts.push(p1);
    tgs.push(t1);
    if (pts.length === 2) {   // lift the middle of short hops so the camera arcs instead of sliding
      const mid = p0.clone().lerp(p1, 0.5);
      mid.y += Math.min(p0.distanceTo(p1) * 0.18, 10);
      pts.splice(1, 0, mid);
      tgs.splice(1, 0, t0.clone().lerp(t1, 0.5));
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const dist = curve.getLength();
    const dur = ch.duration || THREE.MathUtils.clamp(dist * 0.12 + 3, 4, 8);
    move = { curve, tgs, dur, t: 0 };
    arrival = null;
  }

  function targetAt(tgs, u) {
    const seg = (tgs.length - 1) * u, i = Math.min(Math.floor(seg), tgs.length - 2);
    return tgs[i].clone().lerp(tgs[i + 1], seg - i);
  }

  function placeRig(ch) {
    const [x, z] = ch.vr;
    const tg = ch.camera.target;
    rig.position.set(x, Math.max(heightAt(x, z) + 0.1, -0.05), z);
    rig.rotation.y = Math.atan2(-(tg[0] - x), -(tg[2] - z));
  }

  // ---------- public ----------
  function goTo(i, play) {
    const ch = site.chapters[i];
    previewing = false;
    state.index = i;
    state.ended = false;
    state.sentence = '';
    if (play) state.playing = true;
    if (inVr) {
      fadeThen(() => placeRig(ch));
      move = null;
    } else {
      controls.enabled = false;
      flyTo(ch);
    }
    if (state.playing) startNarration(i, inVr ? 1 : Math.min(1.4, (move?.dur || 2) * 0.25));
    else stopVoice();
    emit();
  }

  function pause() {
    state.playing = false;
    stopVoice();
    narration = null;
    if (!inVr) {
      move = null;
      controls.enabled = true;
    }
    emit();
  }

  function resume() {
    if (state.index < 0 || state.ended) { goTo(state.ended ? 0 : Math.max(state.index, 0), true); return; }
    state.playing = true;
    if (!inVr) {
      controls.enabled = false;
      flyTo(site.chapters[state.index]);
    }
    startNarration(state.index, 0.5);
    emit();
  }

  function update(dt, t) {
    now = t;
    updateFade(dt);
    if (inVr) {
      advanceIfDone();
      return;
    }
    if (previewing) {
      const a = t * 0.035;
      camera.position.set(Math.sin(a) * 175 + 10, 58, Math.cos(a) * 175 + 60);
      controls.target.set(0, 6, 25);
      camera.lookAt(controls.target);
      return;
    }
    if (move) {
      move.t += dt;
      const u = ease(move.t / move.dur);
      camera.position.copy(move.curve.getPointAt(u));
      controls.target.copy(targetAt(move.tgs, u));
      camera.lookAt(controls.target);
      if (move.t >= move.dur) {
        move = null;
        arrival = { t, offset: camera.position.clone().sub(controls.target) };
      }
    } else if (arrival && state.playing) {
      // drift slowly around the subject while the narrator speaks
      const a = Math.sin((t - arrival.t) * 0.12) * 0.07;
      const off = arrival.offset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
      camera.position.copy(controls.target).add(off);
      camera.lookAt(controls.target);
    }
    advanceIfDone();
  }

  function advanceIfDone() {
    if (!state.playing || !narration?.done || move || now - narration.doneAt < 1.8) return;
    if (state.index < site.chapters.length - 1) goTo(state.index + 1, true);
    else {
      state.playing = false;
      state.ended = true;
      narration = null;
      controls.enabled = !inVr;
      emit();
    }
  }

  renderer.domElement.addEventListener('pointerdown', () => { if (state.playing && !inVr) pause(); });

  return {
    state,
    goTo,
    fadeThen,
    update,
    toggle: () => (state.playing ? pause() : resume()),
    preview() { previewing = true; controls.enabled = false; },
    explore() {
      previewing = false;
      state.playing = false;
      state.index = 1;
      flyTo(site.chapters[1]);
      move.dur = 5;
      setTimeout(() => { controls.enabled = true; }, 5200);
      emit();
    },
    refreshVoice() {
      // language or sound changed: start the chapter's narration again with the right voice
      if (state.playing && narration) startNarration(state.index, 0.3);
      else emit();
    },
    enterVr() {
      inVr = true;
      previewing = false;
      move = null;
      camera.position.set(0, 0, 0);
      camera.rotation.set(0, 0, 0);
      if (state.index >= 0) placeRig(site.chapters[state.index]);
    },
    exitVr() {
      inVr = false;
      rig.position.set(0, 0, 0);
      rig.rotation.set(0, 0, 0);
      const ch = site.chapters[Math.max(state.index, 1)];
      camera.position.set(...ch.camera.position);
      controls.target.set(...ch.camera.target);
      controls.enabled = !state.playing;
      if (state.playing) flyTo(ch);
    },
  };
}
