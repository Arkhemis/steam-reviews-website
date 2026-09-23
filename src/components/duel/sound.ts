// Le son du battle, synthétisé en direct avec la Web Audio API : une boucle
// chiptune et des bruitages, sans le moindre fichier. Tout est composé ici,
// donc libre de droits par construction, et rien à héberger ni à précharger.
//
// Les navigateurs refusent de jouer du son avant un geste de l'utilisateur :
// `unlock()` doit être appelé dans un clic (le « Play as… » de l'arène).

export type Sfx =
  | "click"
  | "fight"
  | "hit"
  | "crit"
  | "miss"
  | "dodge"
  | "bomb"
  | "backfire"
  | "refund"
  | "stun"
  | "heal"
  | "skip"
  | "victory"
  | "defeat";

const midi = (note: number) => 440 * 2 ** ((note - 69) / 12);

// La grille : 4 mesures de 16 doubles-croches, La m – Fa – Do – Sol.
const CHORDS: { root: number; minor: boolean }[] = [
  { root: 45, minor: true },
  { root: 41, minor: false },
  { root: 48, minor: false },
  { root: 43, minor: false },
];

// La mélodie, en croches (32 par tour de grille) ; `null` = silence.
const MELODY: (number | null)[] = [
  69, null, 72, 74, 76, null, 74, 72, 69, null, 67, 69, null, null, 64, null,
  67, null, 69, 72, 74, null, 72, 74, 76, 79, 76, 74, 72, null, 71, null,
];

const MUSIC_VOLUME = 0.32;
const SFX_VOLUME = 0.8;
const LOOKAHEAD_S = 0.12;

export class DuelAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private scheduler: ReturnType<typeof setInterval> | null = null;
  private nextStepAt = 0;
  private step = 0;
  private danger = false;
  private muted = false;

  /** Crée (ou réveille) le contexte audio : à appeler dans un geste utilisateur. */
  unlock(): void {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(ctx.destination);
      this.music = ctx.createGain();
      this.music.gain.value = MUSIC_VOLUME;
      this.music.connect(this.master);
      this.sfx = ctx.createGain();
      this.sfx.gain.value = SFX_VOLUME;
      this.sfx.connect(this.master);
      // Une seconde de bruit blanc, réutilisée par la batterie et les explosions.
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.04);
  }

  /** Quand un camp passe sous 30 % de PV, la musique accélère et la mélodie monte d'une octave. */
  setDanger(danger: boolean): void {
    this.danger = danger;
  }

  /** Baisse la musique pendant qu'une voix lit une review. */
  duck(on: boolean): void {
    if (!this.ctx || !this.music || !this.scheduler) return;
    this.music.gain.setTargetAtTime(on ? MUSIC_VOLUME * 0.35 : MUSIC_VOLUME, this.ctx.currentTime, 0.08);
  }

  startMusic(): void {
    if (!this.ctx) return;
    this.stopMusic();
    this.step = 0;
    this.danger = false;
    this.nextStepAt = this.ctx.currentTime + 0.25;
    this.music?.gain.setValueAtTime(MUSIC_VOLUME, this.ctx.currentTime);
    this.scheduler = setInterval(() => this.schedule(), 25);
  }

  stopMusic(fadeS = 0): void {
    if (this.scheduler) clearInterval(this.scheduler);
    this.scheduler = null;
    if (this.ctx && this.music && fadeS > 0) {
      const t = this.ctx.currentTime;
      this.music.gain.setValueAtTime(this.music.gain.value, t);
      this.music.gain.linearRampToValueAtTime(0, t + fadeS);
    }
  }

  dispose(): void {
    this.stopMusic();
    void this.ctx?.close();
    this.ctx = null;
  }

  // --- Synthèse ----------------------------------------------------------------

  private tone(
    bus: GainNode | null,
    type: OscillatorType,
    freq: number,
    at: number,
    dur: number,
    volume: number,
    slideTo?: number,
  ): void {
    const ctx = this.ctx;
    if (!ctx || !bus) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain).connect(bus);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  private burst(
    bus: GainNode | null,
    at: number,
    dur: number,
    volume: number,
    filter: BiquadFilterType,
    freq: number,
    freqTo?: number,
  ): void {
    const ctx = this.ctx;
    if (!ctx || !bus || !this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const biquad = ctx.createBiquadFilter();
    biquad.type = filter;
    biquad.frequency.setValueAtTime(freq, at);
    if (freqTo) biquad.frequency.exponentialRampToValueAtTime(freqTo, at + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(biquad).connect(gain).connect(bus);
    src.start(at, Math.random() * 0.5);
    src.stop(at + dur + 0.02);
  }

  // --- Musique -----------------------------------------------------------------

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    while (this.nextStepAt < ctx.currentTime + LOOKAHEAD_S) {
      this.playStep(this.step, this.nextStepAt);
      const bpm = this.danger ? 156 : 132;
      this.nextStepAt += 60 / bpm / 4;
      this.step = (this.step + 1) % 64;
    }
  }

  private playStep(step: number, at: number): void {
    const bus = this.music;
    const chord = CHORDS[Math.floor(step / 16)];
    const sixteenth = 60 / (this.danger ? 156 : 132) / 4;

    // Batterie : grosse caisse à la noire, caisse claire sur 2 et 4, charleston en contretemps.
    if (step % 4 === 0) this.tone(bus, "sine", 150, at, 0.14, 0.7, 45);
    if (step % 8 === 4) this.burst(bus, at, 0.12, 0.35, "highpass", 1800);
    if (step % 2 === 1) this.burst(bus, at, 0.03, this.danger ? 0.14 : 0.08, "highpass", 7000);

    // Basse en croches, qui saute à l'octave une fois sur deux.
    if (step % 2 === 0) {
      const octave = (step / 2) % 2 === 1 ? 12 : 0;
      this.tone(bus, "square", midi(chord.root + octave), at, sixteenth * 1.8, 0.16);
    }

    // Arpège en doubles-croches, deux octaves au-dessus.
    const tones = chord.minor ? [0, 3, 7, 12] : [0, 4, 7, 12];
    this.tone(bus, "triangle", midi(chord.root + 24 + tones[step % 4]), at, sixteenth * 0.9, 0.09);

    // Mélodie en croches.
    if (step % 2 === 0) {
      const note = MELODY[(step / 2) % MELODY.length];
      if (note !== null) this.tone(bus, "square", midi(note + (this.danger ? 12 : 0)), at, sixteenth * 1.7, 0.07);
    }
  }

  // --- Bruitages ---------------------------------------------------------------

  play(sfx: Sfx, delayMs = 0): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delayMs / 1000;
    const bus = this.sfx;
    const explosion = (at: number, size: number) => {
      this.burst(bus, at, 0.7 * size, 0.7, "lowpass", 1600, 90);
      this.tone(bus, "sine", 110, at, 0.5 * size, 0.6, 30);
    };

    switch (sfx) {
      case "click":
        this.tone(bus, "square", 1200, t, 0.03, 0.06);
        break;
      case "fight":
        for (const n of [57, 61, 64, 69]) this.tone(bus, "square", midi(n), t, 0.45, 0.07);
        this.burst(bus, t, 0.25, 0.4, "bandpass", 2000);
        break;
      case "hit":
        this.tone(bus, "square", 260, t, 0.12, 0.22, 90);
        this.burst(bus, t, 0.08, 0.35, "bandpass", 1500);
        break;
      case "crit":
        this.tone(bus, "square", 520, t, 0.22, 0.25, 100);
        this.burst(bus, t, 0.18, 0.45, "highpass", 1200);
        this.tone(bus, "triangle", 1760, t + 0.05, 0.18, 0.15);
        break;
      case "miss":
        this.burst(bus, t, 0.28, 0.25, "bandpass", 3200, 400);
        break;
      case "dodge":
        this.burst(bus, t, 0.2, 0.2, "bandpass", 500, 3500);
        this.tone(bus, "sine", 500, t, 0.16, 0.1, 1300);
        break;
      case "bomb":
        // Le sifflement de la chute, puis l'explosion au moment du choc.
        this.tone(bus, "sine", 1600, t - 0.2 > ctx.currentTime ? t - 0.2 : t, 0.2, 0.12, 400);
        explosion(t + 0.05, 1);
        break;
      case "backfire":
        explosion(t, 0.8);
        // Le « wah-wah » de la honte.
        this.tone(bus, "sawtooth", midi(55), t + 0.35, 0.3, 0.09, midi(54));
        this.tone(bus, "sawtooth", midi(53), t + 0.7, 0.5, 0.09, midi(50));
        break;
      case "refund":
        // « Ka-ching » : la caisse enregistreuse.
        this.burst(bus, t, 0.05, 0.3, "highpass", 3000);
        this.tone(bus, "triangle", midi(88), t + 0.03, 0.08, 0.25);
        this.tone(bus, "triangle", midi(93), t + 0.1, 0.4, 0.25);
        break;
      case "stun":
        [72, 67, 62].forEach((n, i) => this.tone(bus, "square", midi(n), t + i * 0.09, 0.08, 0.1));
        break;
      case "heal":
        [72, 76, 79, 84].forEach((n, i) => this.tone(bus, "triangle", midi(n), t + i * 0.07, 0.16, 0.2));
        break;
      case "skip":
        this.tone(bus, "sawtooth", 110, t, 0.35, 0.08, 90);
        break;
      case "victory":
        [72, 76, 79].forEach((n, i) => this.tone(bus, "square", midi(n), t + i * 0.13, 0.12, 0.12));
        for (const n of [72, 76, 79, 84]) this.tone(bus, "square", midi(n), t + 0.42, 0.9, 0.07);
        this.tone(bus, "triangle", midi(48), t + 0.42, 0.9, 0.3);
        break;
      case "defeat":
        [67, 66, 65, 64].forEach((n, i) => this.tone(bus, "sawtooth", midi(n), t + i * 0.28, i === 3 ? 0.9 : 0.26, 0.08));
        this.tone(bus, "triangle", midi(40), t + 0.84, 0.9, 0.25);
        break;
    }
  }
}
