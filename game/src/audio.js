// All sound is synthesized with WebAudio: no audio files, no network.
// A tiny step sequencer plays a laid-back bassline while driving, and
// one-shot blips cover gunshots, sirens, pickups and mission stings.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicTimer = null;
  let muted = false;
  let step = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq || 1200;
    const g = ctx.createGain();
    g.gain.value = vol || 0.25;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
  }

  // Bassline in A minor, one note per 8th at 112 BPM.
  const BASS = [55, 0, 55, 65.4, 55, 0, 49, 55, 55, 0, 55, 65.4, 82.4, 0, 73.4, 65.4];
  const HAT = [1, 0, 1, 0, 1, 0, 1, 1];

  function startMusic() {
    if (!ensure() || musicTimer) return;
    musicTimer = setInterval(() => {
      if (muted || document.hidden) { step++; return; }
      const n = BASS[step % BASS.length];
      if (n) tone(n, 0.22, 'triangle', 0.22);
      if (HAT[step % HAT.length]) noise(0.04, 0.05, 6000);
      if (step % 16 === 14) tone(220, 0.3, 'sine', 0.06, 330);
      step++;
    }, 268);
  }

  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }

  return {
    unlock() { ensure(); startMusic(); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.35;
      return muted;
    },
    get muted() { return muted; },
    shoot() { noise(0.12, 0.3, 2400); tone(180, 0.08, 'square', 0.12, 60); },
    punch() { noise(0.08, 0.2, 800); },
    crash() { noise(0.25, 0.35, 500); tone(90, 0.2, 'sawtooth', 0.15, 40); },
    siren() { tone(700, 0.35, 'sine', 0.08, 950); tone(950, 0.35, 'sine', 0.08, 700); },
    pickup() { tone(660, 0.09, 'sine', 0.18); setTimeout(() => tone(990, 0.14, 'sine', 0.18), 90); },
    missionOk() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.2), i * 110));
    },
    missionFail() { tone(220, 0.4, 'sawtooth', 0.15, 110); },
    busted() { tone(440, 0.5, 'sawtooth', 0.18, 220); },
    engine(on) { /* engine hum is the music's bass; kept as a hook */ },
    stopMusic,
  };
}
