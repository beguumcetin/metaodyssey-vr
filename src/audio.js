// Ambient sound made in the browser (no audio files): wind, cicadas and the odd bird call.
export function createAmbience() {
  let ctx = null, master = null, muted = false;

  function noiseBuffer(seconds, brown) {
    const len = ctx.sampleRate * seconds, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      d[i] = brown ? (last = (last + 0.02 * w) / 1.02) * 3.5 : w;
    }
    return buf;
  }
  function loop(buf) {
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.start();
    return s;
  }

  function wind() {
    const src = loop(noiseBuffer(6, true));
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    const g = ctx.createGain();
    g.gain.value = 0.35;
    const lfo = ctx.createOscillator(), lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 0.22;
    lfo.connect(lfoGain).connect(g.gain);
    lfo.start();
    src.connect(lp).connect(g).connect(master);
  }

  function cicadas() {
    const src = loop(noiseBuffer(3, false));
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 5200;
    bp.Q.value = 6;
    const pulse = ctx.createGain();
    pulse.gain.value = 0;
    const osc = ctx.createOscillator(), oscGain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 42;
    oscGain.gain.value = 0.5;
    osc.connect(oscGain).connect(pulse.gain);
    osc.start();
    const phrase = ctx.createGain();
    phrase.gain.value = 0;
    src.connect(bp).connect(pulse).connect(phrase).connect(master);
    // swell in and out in long phrases
    const schedule = () => {
      const t = ctx.currentTime, on = 4 + Math.random() * 6, off = 2 + Math.random() * 5;
      phrase.gain.cancelScheduledValues(t);
      phrase.gain.setTargetAtTime(0.05 + Math.random() * 0.035, t, 0.8);
      phrase.gain.setTargetAtTime(0, t + on, 0.9);
      setTimeout(schedule, (on + off) * 1000);
    };
    schedule();
  }

  function birdCall() {
    const t = ctx.currentTime, notes = 2 + Math.floor(Math.random() * 4);
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(master);
    for (let i = 0; i < notes; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain(), s = t + i * (0.11 + Math.random() * 0.06);
      const f = 2600 + Math.random() * 1800;
      o.frequency.setValueAtTime(f, s);
      o.frequency.exponentialRampToValueAtTime(f * (0.7 + Math.random() * 0.6), s + 0.08);
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.03, s + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.09);
      o.connect(g).connect(pan);
      o.start(s);
      o.stop(s + 0.1);
    }
    setTimeout(birdCall, 3000 + Math.random() * 9000);
  }

  return {
    start() {
      if (ctx) return ctx.resume();
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.8;
      master.connect(ctx.destination);
      wind();
      cicadas();
      setTimeout(birdCall, 2000);
    },
    setMuted(m) {
      muted = m;
      if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.2);
    },
    get muted() { return muted; },
  };
}
