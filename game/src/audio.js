// Every sound in Solara Bay is synthesised with WebAudio — no audio files,
// no network. A tiny bass-and-chords loop plays under the game, and short
// blips cover gunshots, punches, crashes, sirens and mission jingles.
// The AudioContext is created lazily on the first user gesture.

const BASS_LINE = [55, 55, 65.41, 49, 55, 65.41, 73.42, 65.41]; // A1 A1 C2 G1 ...
const MISSION_ARP = [523, 659, 784, 1046];
const BUSTED_ARP = [392, 330, 262, 196];

export function createAudio() {
  let actx = null;
  let muted = false;
  let loopId = null;
  let step = 0;

  function audioCtx() {
    if (actx) return actx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      actx = new AC();
      return actx;
    } catch {
      return null;
    }
  }

  /** One oscillator blip: a tone that slides and fades out. */
  function blip(freq, dur, wave, vol, delay = 0, slide = 0) {
    if (muted) return;
    const ctx = audioCtx();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, start);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slide), start + dur);
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  /** Filtered noise burst: the thud behind punches, shots and crashes. */
  function thud(dur, vol, cutoff) {
    if (muted) return;
    const ctx = audioCtx();
    if (!ctx) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(ctx.currentTime);
  }

  /** A short melody: each [freq, delay] pair is one blip. */
  function tune(notes, wave, vol, noteDur, gap) {
    notes.forEach((freq, i) => blip(freq, noteDur, wave, vol, i * gap));
  }

  function startLoop() {
    if (loopId !== null) return;
    if (!audioCtx()) return;
    loopId = window.setInterval(() => {
      if (muted || !actx || actx.state !== 'running') return;
      const root = BASS_LINE[step % BASS_LINE.length];
      blip(root, 0.5, 'triangle', 0.1);
      blip(root * 2, 0.22, 'square', 0.03);
      if (step % 4 === 0) blip(root * 4, 0.4, 'sine', 0.05);
      step += 1;
    }, 300);
  }

  return {
    unlock() {
      const ctx = audioCtx();
      if (ctx && ctx.state === 'suspended') ctx.resume();
      startLoop();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() { return muted; },
    click() { blip(660, 0.07, 'square', 0.06); },
    punch() { thud(0.12, 0.25, 900); blip(120, 0.1, 'sine', 0.2, 0, 60); },
    shoot() { thud(0.14, 0.4, 3200); blip(900, 0.08, 'square', 0.12, 0, 120); },
    crash() { thud(0.3, 0.4, 700); blip(90, 0.25, 'sine', 0.25, 0, 40); },
    pickup() { blip(880, 0.09, 'sine', 0.12); blip(1320, 0.14, 'sine', 0.12, 0.09); },
    cash() { blip(1046, 0.1, 'triangle', 0.14); blip(1318, 0.1, 'triangle', 0.14, 0.08); blip(1568, 0.2, 'triangle', 0.14, 0.16); },
    siren() { blip(700, 0.5, 'sine', 0.05, 0, 950); blip(950, 0.5, 'sine', 0.05, 0.5, 700); },
    mission() { tune(MISSION_ARP, 'triangle', 0.14, 0.18, 0.11); },
    horn() { blip(370, 0.18, 'square', 0.08); blip(466, 0.18, 'square', 0.06); },
    busted() { tune(BUSTED_ARP, 'sawtooth', 0.08, 0.3, 0.22); },
    engine(speed01) {
      const ctx = audioCtx();
      const level = Math.min(1, Math.max(0, speed01 || 0));
      if (muted || !ctx || ctx.state !== 'running') return;
      blip(50 + level * 90, 0.09, 'sawtooth', 0.02 + level * 0.02);
    },
  };
}
