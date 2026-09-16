/**
 * All sounds are synthesised with the Web Audio API; nothing is loaded from
 * disk. The context is created lazily on the first user gesture so autoplay
 * policies never surface as errors.
 */
type Wave = OscillatorType;

interface Voice {
  freq: number;
  wave?: Wave;
  attack?: number;
  decay?: number;
  gain?: number;
  slide?: number;
  delay?: number;
}

export class AudioService {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private soundEnabled = true;
  private musicEnabled = true;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private unlocked = false;
  /** Throttle for high-frequency sfx (shooting) so they don't stack up. */
  private lastShootAt = 0;

  /** Call from a pointer/keyboard handler. Safe to call repeatedly. */
  unlock(): void {
    if (this.unlocked) {
      // Already created: re-arm the state watcher (some browsers clear
      // onstatechange) and force-resume whenever the context is not running —
      // desktop Chrome can auto-suspend an idle context after tab switches,
      // which previously left the game silent until a full reload.
      if (this.ctx) {
        this.armStateWatcher();
        if (this.ctx.state !== 'running') void this.ctx.resume().catch(() => undefined);
      }
      return;
    }
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicEnabled ? 0.12 : 0;
      this.musicGain.connect(this.master);
      this.unlocked = true;
      this.armStateWatcher();
      if (this.ctx.state !== 'running') void this.ctx.resume().catch(() => undefined);
      this.startMusic();
    } catch {
      this.ctx = null;
    }
  }

  private armStateWatcher(): void {
    if (!this.ctx) return;
    this.ctx.onstatechange = () => {
      if (!this.ctx) return;
      // 'interrupted' is a Safari-only state not present in the DOM types.
      const state: string = this.ctx.state;
      if ((state === 'interrupted' || state === 'suspended') && document.visibilityState === 'visible') {
        void this.ctx.resume().catch(() => undefined);
      }
    };
  }

  setSoundEnabled(v: boolean): void {
    this.soundEnabled = v;
  }

  setMusicEnabled(v: boolean): void {
    this.musicEnabled = v;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(v ? 0.12 : 0, this.ctx.currentTime, 0.05);
    }
    if (v) this.startMusic();
    else this.stopMusic();
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend().catch(() => undefined);
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
  }

  private play(voices: Voice[], destination?: AudioNode): void {
    if (!this.ctx || !this.master) return;
    const out = destination ?? this.master;
    const now = this.ctx.currentTime;
    for (const v of voices) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const start = now + (v.delay ?? 0);
      const attack = v.attack ?? 0.005;
      const decay = v.decay ?? 0.12;
      const peak = v.gain ?? 0.3;
      osc.type = v.wave ?? 'sine';
      osc.frequency.setValueAtTime(v.freq, start);
      if (v.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, v.freq * v.slide), start + decay);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
      osc.connect(gain);
      gain.connect(out);
      osc.start(start);
      osc.stop(start + attack + decay + 0.02);
    }
  }

  private sfx(voices: Voice[]): void {
    if (!this.soundEnabled) return;
    this.play(voices);
  }

  private noise(duration: number, gainValue: number, filterFreq: number): void {
    if (!this.ctx || !this.master || !this.soundEnabled) return;
    const ctx = this.ctx;
    const frames = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = gainValue;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
  }

  // --- game sfx ---------------------------------------------------------------

  /** Fires constantly; keep it quiet, short and throttled. */
  shoot(): void {
    const now = Date.now();
    if (now - this.lastShootAt < 70) return;
    this.lastShootAt = now;
    this.sfx([{ freq: 880, wave: 'square', decay: 0.05, gain: 0.05, slide: 0.7 }]);
  }

  hit(): void {
    this.sfx([{ freq: 320, wave: 'triangle', decay: 0.05, gain: 0.08, slide: 0.8 }]);
  }

  explode(): void {
    this.noise(0.35, 0.3, 900);
    this.sfx([
      { freq: 140, wave: 'sawtooth', decay: 0.35, gain: 0.2, slide: 0.4 },
      { freq: 70, wave: 'sine', decay: 0.4, gain: 0.25, slide: 0.5 },
    ]);
  }

  pickup(): void {
    this.sfx([
      { freq: 660, wave: 'triangle', decay: 0.08, gain: 0.14 },
      { freq: 990, wave: 'sine', decay: 0.12, gain: 0.12, delay: 0.06 },
    ]);
  }

  hurt(): void {
    this.sfx([
      { freq: 220, wave: 'square', decay: 0.18, gain: 0.16, slide: 0.5 },
      { freq: 150, wave: 'sawtooth', decay: 0.22, gain: 0.12, slide: 0.6 },
    ]);
    this.noise(0.12, 0.12, 800);
  }

  shield(): void {
    this.sfx([
      { freq: 520, wave: 'sine', decay: 0.2, gain: 0.14, slide: 1.5 },
      { freq: 780, wave: 'sine', decay: 0.25, gain: 0.1, delay: 0.08, slide: 1.3 },
    ]);
  }

  levelup(): void {
    this.sfx([
      { freq: 523, wave: 'triangle', decay: 0.12, gain: 0.16 },
      { freq: 784, wave: 'triangle', decay: 0.16, gain: 0.16, delay: 0.08 },
    ]);
  }

  gameover(): void {
    this.sfx([
      { freq: 392, wave: 'triangle', decay: 0.25, gain: 0.18 },
      { freq: 349, wave: 'triangle', decay: 0.25, gain: 0.18, delay: 0.18 },
      { freq: 294, wave: 'sawtooth', decay: 0.5, gain: 0.14, delay: 0.36, slide: 0.8 },
    ]);
  }

  button(): void {
    this.sfx([{ freq: 660, wave: 'triangle', decay: 0.06, gain: 0.12 }, { freq: 880, wave: 'sine', decay: 0.08, gain: 0.08, delay: 0.03 }]);
  }

  /** New record fanfare. */
  win(): void {
    const melody = [523, 659, 784, 1047, 1319];
    this.sfx(melody.map((f, i) => ({ freq: f, wave: 'triangle' as Wave, decay: 0.3, gain: 0.2, delay: i * 0.09 })));
    this.sfx(melody.map((f, i) => ({ freq: f / 2, wave: 'sine' as Wave, decay: 0.4, gain: 0.1, delay: i * 0.09 })));
  }

  // --- music: a slow, generative pad loop --------------------------------------

  private startMusic(): void {
    if (!this.ctx || !this.musicGain || !this.musicEnabled || this.musicTimer !== null) return;
    const chords = [
      [261.6, 329.6, 392.0, 493.9],
      [220.0, 261.6, 329.6, 415.3],
      [174.6, 220.0, 261.6, 349.2],
      [196.0, 246.9, 293.7, 392.0],
    ];
    const tick = (): void => {
      if (!this.ctx || !this.musicGain) return;
      const chord = chords[this.musicStep % chords.length] as number[];
      const voices: Voice[] = chord.map((f, i) => ({ freq: f, wave: 'sine', attack: 0.6, decay: 2.2, gain: 0.5, delay: i * 0.12 }));
      const top = chord[(this.musicStep * 3) % chord.length] as number;
      voices.push({ freq: top * 2, wave: 'triangle', attack: 0.02, decay: 0.6, gain: 0.25, delay: 1.2 });
      this.play(voices, this.musicGain);
      this.musicStep++;
    };
    tick();
    this.musicTimer = window.setInterval(tick, 3000);
  }

  private stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
