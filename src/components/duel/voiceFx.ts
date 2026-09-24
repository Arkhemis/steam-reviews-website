// Le traitement des voix du battle. Google rend une voix neutre, en MP3 ; on la
// retravaille hors ligne (OfflineAudioContext) avant de la jouer :
//
// 1. la hauteur, en rééchantillonnant — ce qui change aussi la durée ;
// 2. un effet (robot, écho, radio…), dans le même rendu ;
// 3. à la lecture, `preservesPitch` étire le temps sans toucher à la hauteur
//    obtenue : la vitesse ne dépend plus que de la longueur de la réplique.

export type VoiceEffect =
  | "none"
  | "wobble"
  | "robot"
  | "metal"
  | "alien"
  | "megaphone"
  | "cave";

export type VoiceFx = {
  /** Facteur de hauteur : 2 = une octave au-dessus, 0,5 = une en dessous. */
  pitch: number;
  effect: VoiceEffect;
  /** Intensité de l'effet, de 0 à 1. */
  amount: number;
  /** Le réglage propre à l'effet (fréquence, délai…), voir `EFFECTS`. */
  param: number;
};

type EffectInfo = { label: string; param?: { label: string; min: number; max: number; step: number; default: number } };

export const EFFECTS: Record<VoiceEffect, EffectInfo> = {
  none: { label: "None" },
  wobble: { label: "Wobble", param: { label: "Rate (Hz)", min: 1, max: 14, step: 0.5, default: 6 } },
  robot: { label: "Robot", param: { label: "Carrier (Hz)", min: 20, max: 150, step: 1, default: 50 } },
  metal: { label: "Metallic", param: { label: "Delay (ms)", min: 2, max: 25, step: 0.5, default: 8 } },
  alien: { label: "Alien", param: { label: "Carrier (Hz)", min: 100, max: 900, step: 10, default: 320 } },
  megaphone: { label: "Megaphone" },
  cave: { label: "Cave", param: { label: "Length (s)", min: 0.5, max: 5, step: 0.1, default: 2.5 } },
};

/** Le silence ajouté en fin de rendu pour laisser mourir échos et réverbération. */
const TAIL_S: Partial<Record<VoiceEffect, number>> = { cave: 5, metal: 0.2 };

export type RenderedVoice = {
  /** URL d'objet du WAV traité, à libérer avec `URL.revokeObjectURL`. */
  url: string;
  /** Durée de la parole brute (silences de bord coupés), à vitesse normale, en secondes. */
  duration: number;
  /** Durée du fichier rendu (hauteur et traîne d'effet comprises), en secondes. */
  renderedDuration: number;
  /** Le `playbackRate` (avec `preservesPitch`) qui fait entendre la réplique à `speed`. */
  rateFor(speed: number): number;
};

/**
 * La vitesse de lecture d'une réplique : `base` tant qu'elle tient dans
 * `maxNormal` secondes, accélérée au-delà, jusqu'à `maxSpeed`.
 */
export function autoSpeed(duration: number, maxNormal: number, maxSpeed: number, base = 1): number {
  return Math.min(maxSpeed, Math.max(base, duration / maxNormal));
}

/** Décode `data` (MP3, WAV…) une seule fois, pour pouvoir le rendre sous plusieurs réglages. */
export function decodeVoice(data: ArrayBuffer): Promise<AudioBuffer> {
  return new OfflineAudioContext(1, 1, 44_100).decodeAudioData(data);
}

/** Rend la voix `decoded` avec sa hauteur et son effet. */
export async function renderVoice(decoded: AudioBuffer, fx: VoiceFx): Promise<RenderedVoice> {
  const rate = decoded.sampleRate;
  // Le souffle de tête et de fin part avant tout traitement : il fausserait
  // la durée (donc la vitesse) et s'entendrait comme un blanc entre deux morceaux.
  const speech = trimSilence(decoded.getChannelData(0), rate);
  const length = Math.ceil(speech.length / fx.pitch + (TAIL_S[fx.effect] ?? 0) * rate);
  const ctx = new OfflineAudioContext(1, length, rate);
  const input = ctx.createBuffer(1, speech.length, rate);
  input.getChannelData(0).set(speech);
  const source = ctx.createBufferSource();
  source.buffer = input;
  source.playbackRate.value = fx.pitch;

  // Un compresseur en bout de chaîne resserre la dynamique ; `normalize`
  // égalise ensuite le volume d'une réplique à l'autre.
  const out = ctx.createDynamicsCompressor();
  out.threshold.value = -18;
  out.ratio.value = 4;
  out.connect(ctx.destination);

  const amount = Math.max(0, Math.min(1, fx.amount));
  const param = fx.param || EFFECTS[fx.effect].param?.default || 0;
  applyEffect(ctx, source, out, fx.effect, amount, param);

  source.start();
  const rendered = await ctx.startRendering();
  const samples = normalize(trimSilence(rendered.getChannelData(0), rate));
  return {
    url: URL.createObjectURL(toWav(samples, rate)),
    duration: speech.length / rate,
    renderedDuration: samples.length / rate,
    // Le rendu dure déjà 1/pitch de l'original : on corrige pour tomber sur `speed`.
    rateFor: (speed) => speed / fx.pitch,
  };
}

function lfo(ctx: BaseAudioContext, frequency: number, depth: number, type: OscillatorType = "sine"): AudioNode {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = frequency;
  const gain = ctx.createGain();
  gain.gain.value = depth;
  osc.connect(gain);
  osc.start();
  return gain;
}

/** Mélange sec/traité : `amount` règle la part du signal traité. */
function mix(ctx: BaseAudioContext, input: AudioNode, wet: AudioNode, wetOut: AudioNode, out: AudioNode, amount: number) {
  const dry = ctx.createGain();
  dry.gain.value = 1 - amount;
  input.connect(dry).connect(out);
  input.connect(wet);
  const level = ctx.createGain();
  level.gain.value = amount;
  wetOut.connect(level).connect(out);
}

/** Modulation en anneau : la voix multipliée par une sinusoïde. */
function ringMod(ctx: BaseAudioContext, input: AudioNode, out: AudioNode, carrier: number, amount: number, vibrato = 0) {
  const ring = ctx.createGain();
  ring.gain.value = 0;
  const osc = ctx.createOscillator();
  osc.frequency.value = carrier;
  if (vibrato) lfo(ctx, 3, vibrato).connect(osc.frequency);
  osc.connect(ring.gain);
  osc.start();
  mix(ctx, input, ring, ring, out, amount);
}

function distortion(ctx: BaseAudioContext, drive: number): WaveShaperNode {
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = ((1 + drive) * x) / (1 + drive * Math.abs(x));
  }
  shaper.curve = curve;
  shaper.oversample = "4x";
  return shaper;
}

function filter(ctx: BaseAudioContext, type: BiquadFilterType, frequency: number, q = 0.7): BiquadFilterNode {
  const node = ctx.createBiquadFilter();
  node.type = type;
  node.frequency.value = frequency;
  node.Q.value = q;
  return node;
}

function applyEffect(
  ctx: OfflineAudioContext,
  source: AudioBufferSourceNode,
  out: AudioNode,
  effect: VoiceEffect,
  amount: number,
  param: number,
): void {
  switch (effect) {
    case "wobble":
      // Jusqu'à ±1,5 demi-ton d'ondulation.
      lfo(ctx, param, amount * 150).connect(source.detune);
      source.connect(out);
      return;
    case "robot":
      ringMod(ctx, source, out, param, amount);
      return;
    case "alien":
      ringMod(ctx, source, out, param, amount, param * 0.15);
      return;
    case "metal": {
      // Filtre en peigne : un écho très court réinjecté sur lui-même.
      const delay = ctx.createDelay(0.05);
      delay.delayTime.value = param / 1000;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.35 + amount * 0.5;
      delay.connect(feedback).connect(delay);
      mix(ctx, source, delay, delay, out, 0.3 + amount * 0.5);
      return;
    }
    case "megaphone": {
      const band = filter(ctx, "bandpass", 1600, 0.9);
      source.connect(band).connect(distortion(ctx, 8 + amount * 40)).connect(out);
      return;
    }
    case "cave": {
      const convolver = ctx.createConvolver();
      convolver.buffer = impulse(ctx, param);
      mix(ctx, source, convolver, convolver, out, 0.2 + amount * 0.6);
      return;
    }
    default:
      source.connect(out);
  }
}

/** Une réponse impulsionnelle de réverbération : du bruit qui décroît. */
function impulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  return buffer;
}

/** Le niveau moyen visé pour chaque réplique (RMS, environ -17 dBFS). */
const TARGET_RMS = 0.14;
/** Au-dessus, les crêtes sont arrondies plutôt qu'écrêtées. */
const KNEE = 0.85;

/**
 * Ramène une réplique au même volume que les autres, quels que soient la voix
 * et l'effet (le robot creuse le son, la caverne le gonfle). Le niveau se
 * mesure sur la parole seule, silences exclus ; les crêtes qui dépasseraient
 * passent par un limiteur doux.
 */
export function normalize(samples: Float32Array): Float32Array {
  let sum = 0;
  let voiced = 0;
  for (const s of samples) {
    if (Math.abs(s) > 0.01) {
      sum += s * s;
      voiced++;
    }
  }
  if (!voiced) return samples;
  const gain = Math.min(10, TARGET_RMS / Math.sqrt(sum / voiced));
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i] * gain;
    const level = Math.abs(s);
    out[i] = level <= KNEE ? s : Math.sign(s) * (KNEE + (1 - KNEE) * Math.tanh((level - KNEE) / (1 - KNEE)));
  }
  return out;
}

/** Sous ce niveau (relatif à la fenêtre la plus forte), c'est du souffle ou de la traîne, pas de la parole. */
const SILENCE_DB = -32;

/**
 * Coupe les silences de bord : le souffle que Google met autour de chaque
 * MP3 (environ 0,2 s de part et d'autre) et la traîne d'une réverbération. Le
 * niveau se mesure par fenêtres de 10 ms, relativement à la plus forte : le
 * souffle de Google dépasse un seuil fixe, mais reste 30 dB sous la voix,
 * alors qu'un « f » initial n'en est qu'à 25. Un soupçon de marge évite de
 * mordre dans la première consonne ou d'écourter la dernière.
 */
export function trimSilence(samples: Float32Array, sampleRate: number): Float32Array {
  const window = Math.max(1, Math.round(sampleRate * 0.01));
  const levels: number[] = [];
  for (let i = 0; i < samples.length; i += window) {
    let sum = 0;
    const end = Math.min(samples.length, i + window);
    for (let j = i; j < end; j++) sum += samples[j] * samples[j];
    levels.push(Math.sqrt(sum / (end - i)));
  }
  const loudest = Math.max(0, ...levels);
  if (!loudest) return samples;
  const threshold = loudest * 10 ** (SILENCE_DB / 20);
  const first = levels.findIndex((level) => level >= threshold);
  const last = levels.findLastIndex((level) => level >= threshold);
  const start = Math.max(0, first * window - window);
  const end = Math.min(samples.length, (last + 1) * window + 2 * window);
  return samples.subarray(start, end);
}

/** Encode des échantillons mono en WAV PCM 16 bits. */
function toWav(samples: Float32Array, sampleRate: number): Blob {
  const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const ascii = (offset: number, text: string) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([view], { type: "audio/wav" });
}
