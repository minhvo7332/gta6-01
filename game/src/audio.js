// Synthesized sound for Solara Bay, WebAudio only.
// No audio files, no network: every sound is an oscillator or filtered
// noise built at runtime. The context is created on the first user gesture.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = null;
    this.sirenHigh = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      return true;
    } catch {
      return false;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopEngine();
      this.stopSiren();
    }
    return this.muted;
  }

  _tone(freq, dur, type, vol, slideTo) {
    if (this.muted || !this.ensure()) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol || 0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  _noise(dur, vol, lowFreq) {
    if (this.muted || !this.ensure()) return;
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowFreq || 1200;
    const gain = ctx.createGain();
    gain.gain.value = vol || 0.2;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  playBlip() {
    this._tone(880, 0.12, 'sine', 0.14, 1320);
  }

  playPickup() {
    this._tone(660, 0.1, 'triangle', 0.16, 990);
    setTimeout(() => this._tone(990, 0.14, 'triangle', 0.14, 1320), 90);
  }

  playShot() {
    this._noise(0.14, 0.28, 2400);
    this._tone(180, 0.08, 'square', 0.08, 60);
  }

  playMelee() {
    this._noise(0.09, 0.12, 900);
  }

  playCrash() {
    this._noise(0.25, 0.3, 500);
    this._tone(90, 0.2, 'sawtooth', 0.1, 40);
  }

  playHorn() {
    this._tone(370, 0.18, 'square', 0.07);
  }

  playMissionDone() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => {
      setTimeout(() => this._tone(f, 0.16, 'triangle', 0.15), i * 110);
    });
  }

  playWantedUp() {
    this._tone(220, 0.18, 'sawtooth', 0.1, 440);
  }

  // Continuous engine hum whose pitch follows driving speed (0..1).
  startEngine() {
    if (this.muted || !this.ensure() || this.engineOsc) return;
    const ctx = this.ctx;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.045;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(ctx.destination);
    this.engineOsc.start();
  }

  setEngineSpeed(t) {
    if (!this.engineOsc) return;
    const clamped = Math.max(0, Math.min(1, t));
    this.engineOsc.frequency.setTargetAtTime(55 + clamped * 130, this.ctx.currentTime, 0.08);
    if (this.engineGain) this.engineGain.gain.setTargetAtTime(0.03 + clamped * 0.05, this.ctx.currentTime, 0.1);
  }

  stopEngine() {
    if (!this.engineOsc) return;
    try { this.engineOsc.stop(); } catch { /* already stopped */ }
    this.engineOsc = null;
    this.engineGain = null;
  }

  // Two-tone police siren while any wanted level is active.
  startSiren() {
    if (this.muted || !this.ensure() || this.sirenOsc) return;
    const ctx = this.ctx;
    this.sirenOsc = ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 720;
    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0.035;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(ctx.destination);
    this.sirenOsc.start();
    this.sirenHigh = false;
    this.sirenTimer = setInterval(() => {
      if (!this.sirenOsc) return;
      this.sirenHigh = !this.sirenHigh;
      this.sirenOsc.frequency.setTargetAtTime(this.sirenHigh ? 960 : 720, ctx.currentTime, 0.05);
    }, 420);
  }

  stopSiren() {
    if (this.sirenTimer) clearInterval(this.sirenTimer);
    this.sirenTimer = null;
    if (this.sirenOsc) {
      try { this.sirenOsc.stop(); } catch { /* already stopped */ }
    }
    this.sirenOsc = null;
    this.sirenGain = null;
  }
}

export function createSoundBank() {
  return new SoundBank();
}
