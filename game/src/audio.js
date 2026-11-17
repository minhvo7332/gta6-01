// All sound is synthesised with WebAudio — no audio files, no network.
// Engine hum, sirens, gunshots, punches, pickups, mission jingles and a small
// original bass-and-chords loop. Created lazily on the first user gesture.

const NOTES = [55, 55, 65.41, 49, 55, 65.41, 73.42, 65.41]; // A1 A1 C2 G1 ...

export function createAudio() {
  let ctx = null;
  let muted = false;
  let musicTimer = null;
  let beat = 0;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      return ctx;
    } catch {
      return null;
    }
  }

  function tone(freq, dur, type, gain, when = 0, slideTo = 0) {
    if (muted || !ensure()) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, gain, lowpass) {
    if (muted || !ensure()) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(ctx.destination);
    src.start(t0);
  }

  function startMusic() {
    if (musicTimer !== null || !ensure()) return;
    musicTimer = window.setInterval(() => {
      if (muted || ctx.state !== 'running') return;
      const root = NOTES[beat % NOTES.length];
      tone(root, 0.5, 'triangle', 0.10);
      tone(root * 2, 0.22, 'square', 0.03);
      if (beat % 4 === 0) tone(root * 4, 0.4, 'sine', 0.05);
      beat += 1;
    }, 300);
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); startMusic(); },
    toggleMute() { muted = !muted; return muted; },
    isMuted() { return muted; },
    click() { tone(660, 0.07, 'square', 0.06); },
    punch() { noise(0.12, 0.25, 900); tone(120, 0.1, 'sine', 0.2, 0, 60); },
    shoot() { noise(0.14, 0.4, 3200); tone(900, 0.08, 'square', 0.12, 0, 120); },
    crash() { noise(0.3, 0.4, 700); tone(90, 0.25, 'sine', 0.25, 0, 40); },
    pickup() { tone(880, 0.09, 'sine', 0.12); tone(1320, 0.14, 'sine', 0.12, 0.09); },
    cash() { tone(1046, 0.1, 'triangle', 0.14); tone(1318, 0.1, 'triangle', 0.14, 0.08); tone(1568, 0.2, 'triangle', 0.14, 0.16); },
    siren() { tone(700, 0.5, 'sine', 0.05, 0, 950); tone(950, 0.5, 'sine', 0.05, 0.5, 700); },
    mission() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.14, i * 0.11)); },
    horn() { tone(370, 0.18, 'square', 0.08); tone(466, 0.18, 'square', 0.06); },
    busted() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.08, i * 0.22)); },
    engine(speed01) {
      if (muted || !ensure() || ctx.state !== 'running') return;
      tone(50 + speed01 * 90, 0.09, 'sawtooth', 0.02 + speed01 * 0.02);
    },
  };
}
