/* Synthesised arena sound: no audio files, all Web Audio. */

export function createAudio() {
  let ctx = null, master = null, crowdGain = null, noiseBuf = null, enabled = true;

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // Low crowd murmur bed.
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 520; bp.Q.value = 0.6;
    crowdGain = ctx.createGain(); crowdGain.gain.value = 0.025;
    src.connect(bp).connect(crowdGain).connect(master);
    src.start();
    return true;
  }

  function unlock() {
    if (!init()) return;
    if (ctx.state === "suspended") ctx.resume();
  }

  const now = () => ctx.currentTime;

  function noise(dur, { freq = 1000, q = 1, type = "bandpass", gain = 0.3, attack = 0.005, sweep = 0 } = {}) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), now() + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now());
    g.gain.exponentialRampToValueAtTime(gain, now() + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now() + dur);
    s.connect(f).connect(g).connect(master);
    s.start(now(), Math.random());
    s.stop(now() + dur + 0.05);
  }

  function tone(freq, dur, { type = "sine", gain = 0.2, slide = 0 } = {}) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), now() + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, now());
    g.gain.exponentialRampToValueAtTime(0.0001, now() + dur);
    o.connect(g).connect(master);
    o.start(); o.stop(now() + dur + 0.05);
  }

  const api = {
    unlock,
    setEnabled(on) { enabled = on; if (master) master.gain.value = on ? 0.55 : 0; },
    get enabled() { return enabled; },
    bounce(s) {
      if (!ctx || !enabled) return;
      const k = Math.min(1, s / 6);
      tone(95 + 30 * k, 0.16, { gain: 0.35 * k + 0.05, slide: -50 });
      noise(0.05, { freq: 900, q: 0.8, gain: 0.08 * k + 0.01 });
    },
    rim(s) {
      if (!ctx || !enabled) return;
      const k = Math.min(1, s / 5);
      for (const f of [660, 1180, 1730, 2510]) tone(f * (0.98 + Math.random() * 0.04), 0.35 + 0.3 * k, { type: "triangle", gain: 0.05 * k + 0.01 });
      noise(0.04, { freq: 3000, q: 2, gain: 0.08 * k });
    },
    board(s) {
      if (!ctx || !enabled) return;
      const k = Math.min(1, s / 5);
      tone(170, 0.2, { type: "square", gain: 0.05 * k + 0.01, slide: -60 });
      noise(0.12, { freq: 500, q: 0.7, gain: 0.18 * k + 0.02 });
    },
    swish() {
      if (!ctx || !enabled) return;
      noise(0.32, { freq: 2600, q: 0.6, type: "highpass", gain: 0.22, attack: 0.04, sweep: -1800 });
    },
    cheer(level = 1) {
      if (!ctx || !enabled) return;
      const g = Math.min(0.5, 0.12 + level * 0.06);
      noise(1.6 + level * 0.3, { freq: 900, q: 0.5, gain: g, attack: 0.15 });
      noise(1.2, { freq: 2200, q: 0.7, gain: g * 0.5, attack: 0.2 });
      if (crowdGain) {
        crowdGain.gain.cancelScheduledValues(now());
        crowdGain.gain.setValueAtTime(0.09, now());
        crowdGain.gain.exponentialRampToValueAtTime(0.025, now() + 3);
      }
    },
    groan() {
      if (!ctx || !enabled) return;
      noise(0.9, { freq: 420, q: 1.2, gain: 0.12, attack: 0.1, sweep: -200 });
    },
    correct() {
      if (!ctx || !enabled) return;
      tone(660, 0.14, { type: "triangle", gain: 0.12 });
      setTimeout(() => ctx && tone(990, 0.24, { type: "triangle", gain: 0.12 }), 110);
    },
    wrong() {
      if (!ctx || !enabled) return;
      tone(220, 0.5, { type: "sawtooth", gain: 0.07, slide: -80 });
    },
    buzzer() {
      if (!ctx || !enabled) return;
      tone(180, 0.9, { type: "square", gain: 0.08 });
      tone(183, 0.9, { type: "square", gain: 0.06 });
    },
  };
  return api;
}
