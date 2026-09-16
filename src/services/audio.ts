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
  // Original sound set designed for Hex Breaker: a consistent "wood + glass"
  // palette — triangle/sine chimes for positive events, square/saw drops for
  // damage, filtered noise for impacts. No samples, nothing borrowed.

  /** Fires constantly; keep it quiet, short and throttled. */
  shoot(): void {
    const now = Date.now();
    if (now - this.lastShootAt < 70) return;
    this.lastShootAt = now;
    this.sfx([{ freq: 1250, wave: 'triangle', decay: 0.04, gain: 0.045, slide: 0.6 }]);
  }

  hit(): void {
    this.sfx([
      { freq: 340, wave: 'triangle', decay: 0.05, gain: 0.08, slide: 0.65 },
      { freq: 170, wave: 'sine', decay: 0.06, gain: 0.06, slide: 0.7 },
    ]);
  }

  explode(): void {
    this.noise(0.4, 0.28, 700);
    this.sfx([
      { freq: 120, wave: 'sawtooth', decay: 0.38, gain: 0.2, slide: 0.35 },
      { freq: 55, wave: 'sine', decay: 0.45, gain: 0.25, slide: 0.45 },
    ]);
  }

  pickup(): void {
    // music-box fifth up (A4 -> E5), matching the BGM's D-minor palette
    this.sfx([
      { freq: 440, wave: 'triangle', decay: 0.09, gain: 0.13 },
      { freq: 659, wave: 'triangle', decay: 0.14, gain: 0.11, delay: 0.07 },
    ]);
  }

  hurt(): void {
    this.sfx([
      { freq: 180, wave: 'square', decay: 0.2, gain: 0.15, slide: 0.45 },
      { freq: 120, wave: 'sawtooth', decay: 0.24, gain: 0.11, slide: 0.55 },
    ]);
    this.noise(0.14, 0.11, 650);
  }

  shield(): void {
    // rising two-tone sweep = protective bubble
    this.sfx([
      { freq: 440, wave: 'sine', decay: 0.22, gain: 0.13, slide: 1.6 },
      { freq: 660, wave: 'sine', decay: 0.26, gain: 0.1, delay: 0.09, slide: 1.4 },
    ]);
  }

  levelup(): void {
    this.sfx([
      { freq: 587, wave: 'triangle', decay: 0.12, gain: 0.15 },
      { freq: 880, wave: 'triangle', decay: 0.18, gain: 0.15, delay: 0.08 },
    ]);
  }

  gameover(): void {
    // slow D-minor descent, resolves on the D2 tonic
    this.sfx([
      { freq: 294, wave: 'triangle', decay: 0.3, gain: 0.17 },
      { freq: 220, wave: 'triangle', decay: 0.3, gain: 0.17, delay: 0.2 },
      { freq: 147, wave: 'sawtooth', decay: 0.6, gain: 0.13, delay: 0.4, slide: 0.85 },
    ]);
  }

  button(): void {
    this.sfx([{ freq: 520, wave: 'triangle', decay: 0.06, gain: 0.11 }, { freq: 780, wave: 'sine', decay: 0.08, gain: 0.08, delay: 0.03 }]);
  }

  /** New record fanfare: original D-minor arpeggio, same key as the BGM. */
  win(): void {
    const melody = [294, 349, 440, 587, 699, 880];
    this.sfx(melody.map((f, i) => ({ freq: f, wave: 'triangle' as Wave, decay: 0.28, gain: 0.18, delay: i * 0.08 })));
    this.sfx(melody.map((f, i) => ({ freq: f / 2, wave: 'sine' as Wave, decay: 0.4, gain: 0.09, delay: i * 0.08 })));
  }

  // --- music: original chiptune loop -------------------------------------------
  // Composed for Hex Breaker (no borrowed melody): a music-box motif in
  // D minor pentatonic over a Dm / Bb / F / C walk, with a soft sine bass
  // pulse. 120 BPM, 8th-note grid, 32 steps = 16 s per loop.

  private static readonly STEP_MS = 250; // 8th note at 120 BPM
  private static readonly LOOP_STEPS = 32;

  /** Pad triads per bar (4 bars of 8 steps). */
  private static readonly CHORDS: number[][][] = [
    [[146.8, 174.6, 220.0], [220.0, 261.6, 293.7]], // bar 1: Dm, two soft stabs
    [[116.5, 146.8, 174.6], [174.6, 220.0, 233.1]], // bar 2: Bb -> walk
    [[174.6, 220.0, 261.6], [220.0, 261.6, 329.6]], // bar 3: F -> lift
    [[130.8, 164.8, 196.0], [196.0, 246.9, 293.7]], // bar 4: C -> turn around
  ];

  /** Bass roots per bar (played on steps 0 and 4). */
  private static readonly BASS: number[] = [73.4, 58.3, 87.3, 65.4]; // D2 Bb1 F2 C2

  /** Music-box melody: step -> frequency (missing steps are rests). */
  private static readonly MELODY: Record<number, number> = {
    0: 293.7, 2: 349.2, 4: 440.0, 6: 392.0, //  D4 F4 A4 G4
    8: 349.2, 10: 293.7, 12: 523.3, 14: 440.0, // F4 D4 C5 A4
    16: 392.0, 18: 440.0, 20: 587.3, 22: 523.3, // G4 A4 D5 C5
    24: 440.0, 26: 392.0, 28: 349.2, //          A4 G4 F4
  };

  private startMusic(): void {
    if (!this.ctx || !this.musicGain || !this.musicEnabled || this.musicTimer !== null) return;
    const tick = (): void => {
      if (!this.ctx || !this.musicGain) return;
      const step = this.musicStep % AudioService.LOOP_STEPS;
      const bar = Math.floor(step / 8);
      const inBar = step % 8;
      const voices: Voice[] = [];
      // bass pulse on beats 1 and 3
      if (inBar === 0 || inBar === 4) {
        voices.push({ freq: AudioService.BASS[bar] as number, wave: 'sine', attack: 0.01, decay: 0.5, gain: 0.55 });
      }
      // pad stab at the start of each half-bar
      if (inBar === 0 || inBar === 4) {
        const chord = (AudioService.CHORDS[bar] as number[][])[inBar === 0 ? 0 : 1] as number[];
        for (const [i, f] of chord.entries()) {
          voices.push({ freq: f, wave: 'triangle', attack: 0.25, decay: 1.1, gain: 0.16, delay: i * 0.05 });
        }
      }
      // music-box motif
      const note = AudioService.MELODY[step];
      if (note) {
        voices.push({ freq: note, wave: 'triangle', attack: 0.005, decay: 0.34, gain: 0.3 });
        voices.push({ freq: note * 2, wave: 'sine', attack: 0.005, decay: 0.2, gain: 0.08 });
      }
      if (voices.length) this.play(voices, this.musicGain);
      this.musicStep++;
    };
    tick();
    this.musicTimer = window.setInterval(tick, AudioService.STEP_MS);
  }

  private stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
