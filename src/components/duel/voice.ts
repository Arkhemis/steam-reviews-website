import { autoSpeed, decodeVoice, renderVoice, type RenderedVoice } from "@/components/duel/voiceFx";
import {
  BASE_SPEED,
  CPU_PRESETS,
  MAX_NORMAL_S,
  MAX_SPEED,
  PLAYER_PRESET,
  type VoicePreset,
} from "@/components/duel/voicePresets";
import { GOOGLE_TTS_MAX } from "@/lib/tts";

// Les voix du battle : chaque review lancée est lue à voix haute. La voix est
// celle de Google Traduction, la même partout, retravaillée dans le navigateur
// (hauteur, effet, vitesse selon la longueur : voir `voiceFx.ts`). Le joueur
// garde une voix normale ; l'ordinateur change de timbre à chaque réplique.
//
// Si Google ne répond pas (ou que la lecture est refusée), la synthèse vocale
// du navigateur (Web Speech API) prend le relais : sa distribution dépend de
// l'OS, on prend ce qu'il propose, et le genre des voix est deviné d'après
// leur nom — l'API ne l'expose pas.

export type VoiceRole = "player" | "cpu";

/** Langue Steam → langue de synthèse (BCP 47). */
const SPEECH_LANG: Record<string, string> = {
  arabic: "ar-SA",
  bulgarian: "bg-BG",
  schinese: "zh-CN",
  tchinese: "zh-TW",
  czech: "cs-CZ",
  danish: "da-DK",
  dutch: "nl-NL",
  english: "en-US",
  finnish: "fi-FI",
  french: "fr-FR",
  german: "de-DE",
  greek: "el-GR",
  hungarian: "hu-HU",
  italian: "it-IT",
  japanese: "ja-JP",
  koreana: "ko-KR",
  norwegian: "nb-NO",
  polish: "pl-PL",
  portuguese: "pt-PT",
  brazilian: "pt-BR",
  romanian: "ro-RO",
  russian: "ru-RU",
  spanish: "es-ES",
  latam: "es-MX",
  swedish: "sv-SE",
  thai: "th-TH",
  turkish: "tr-TR",
  ukrainian: "uk-UA",
  vietnamese: "vi-VN",
};

const norm = (lang: string) => lang.replace("_", "-").toLowerCase();

/**
 * Les voix qui parlent `bcp47` : celles de la bonne variante d'abord
 * (pt-BR plutôt que pt-PT), sinon toutes celles de la langue.
 */
function voicesFor(all: SpeechSynthesisVoice[], bcp47: string): SpeechSynthesisVoice[] {
  const exact = all.filter((v) => norm(v.lang) === norm(bcp47));
  if (exact.length) return exact;
  const base = norm(bcp47).split("-")[0];
  return all.filter((v) => norm(v.lang).split("-")[0] === base);
}

type Casting = { voice: SpeechSynthesisVoice | null; pitch: number; rate: number; volume?: number };

// `female` contient `male` : on teste toujours les voix féminines d'abord.
const FEMALE = /female|woman|samantha|victoria|karen|moira|tessa|fiona|zira|susan|hazel|serena|allison|ava|kate|veena|libby|sonia|aria|jenny|michelle|emma|amy|joanna|salli|kimberly/i;
const MALE = /male|daniel|alex|fred|david|mark|george|guy|ryan|tom|oliver|aaron|arthur|rishi|james|christopher|eric|brian|justin|matthew/i;

function genderOf(voice: SpeechSynthesisVoice): "female" | "male" | null {
  if (FEMALE.test(voice.name)) return "female";
  if (MALE.test(voice.name)) return "male";
  return null;
}

const pickOne = <T>(list: T[]): T | undefined => list[Math.floor(Math.random() * list.length)];

/** Les timbres du méchant : hauteur (0 à 2), débit et volume (0 à 1) de la synthèse. */
const CPU_STYLES: { pitch: number; rate: number; volume?: number }[] = [
  { pitch: 0.1, rate: 0.8 }, // démon
  { pitch: 0.3, rate: 1.1 }, // grave et pressé
  { pitch: 0.6, rate: 0.7 }, // méchant de film, très lent
  { pitch: 1.6, rate: 0.7 }, // méchant de dessin animé
  { pitch: 1.2, rate: 1.25 }, // animateur de jeu télé
  { pitch: 0.5, rate: 0.5 }, // ralenti
  { pitch: 0.2, rate: 0.55 }, // géant ensommeillé
  { pitch: 0.3, rate: 0.75, volume: 0.4 }, // menace chuchotée
  { pitch: 1.6, rate: 1.1 }, // gamin pleurnichard
  { pitch: 1.5, rate: 0.95 }, // elfe suffisant
];

/** La voix de secours : la synthèse vocale du navigateur. */
class BrowserVoices {
  private cast: Record<VoiceRole, Casting> = {
    player: { voice: null, pitch: 1, rate: 1.05 },
    cpu: { voice: null, pitch: 1.9, rate: 1.15 },
  };
  /** Les voix que l'ordinateur peut prendre : toutes, sauf celle du joueur quand l'OS en propose d'autres. */
  private cpuPool: SpeechSynthesisVoice[] = [];
  private lang = "en-US";
  private lastCpu: { voice: SpeechSynthesisVoice | null; style: number } = { voice: null, style: -1 };
  /** Change à chaque lecture : les morceaux d'une réplique coupée ne sont plus lus. */
  private seq = 0;

  static supported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
  }

  /**
   * Distribue les rôles pour un nouveau duel, dans la langue des reviews.
   * Sans voix installée pour cette langue, les deux rôles restent sans voix
   * attitrée : le navigateur lit alors avec sa voix par défaut pour `lang`.
   */
  recast(steamLanguage: string): void {
    if (!BrowserVoices.supported()) return;
    this.lang = SPEECH_LANG[steamLanguage] ?? "en-US";
    const pool = voicesFor(window.speechSynthesis.getVoices(), this.lang);

    const byGender = (g: "female" | "male") => pool.filter((v) => genderOf(v) === g);
    const playerGender = Math.random() < 0.5 ? "female" : "male";
    const playerVoice = pickOne(byGender(playerGender)) ?? pickOne(pool) ?? null;
    const others = pool.filter((v) => v !== playerVoice);
    this.cpuPool = others.length ? others : pool;
    this.lastCpu = { voice: null, style: -1 };
    this.cast = { ...this.cast, player: { voice: playerVoice, pitch: 1, rate: 1.05 } };
  }

  /** Une voix et un timbre neufs pour la prochaine réplique du méchant : jamais deux fois le même timbre de suite. */
  private recastCpu(): void {
    let style = Math.floor(Math.random() * CPU_STYLES.length);
    if (style === this.lastCpu.style) style = (style + 1) % CPU_STYLES.length;
    const fresh = this.cpuPool.filter((v) => v !== this.lastCpu.voice);
    const voice = pickOne(fresh.length ? fresh : this.cpuPool) ?? null;
    this.lastCpu = { voice, style };
    this.cast.cpu = { voice, ...CPU_STYLES[style] };
  }

  /**
   * Lit une réplique et rend une promesse tenue à la fin de la lecture — ou
   * au plus tard après une durée estimée : certains moteurs n'émettent jamais
   * `end`, et le duel ne doit pas rester suspendu à une voix muette.
   */
  speak(text: string, role: VoiceRole): Promise<void> {
    return this.speakParts([text], role, () => Promise.resolve());
  }

  /**
   * Lit une réplique en morceaux, avec la même voix d'un bout à l'autre ;
   * entre deux morceaux marqués `null`, `bleep` joue le bip de censure et
   * rend la main à la fin de celui-ci. Une lecture lancée entre-temps (ou
   * `cancel`) interrompt la suite.
   */
  async speakParts(parts: (string | null)[], role: VoiceRole, bleep: () => Promise<void>): Promise<void> {
    if (!BrowserVoices.supported()) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const seq = ++this.seq;
    // Sans voix installée (Chrome sous Linux sans speech-dispatcher, navigateur
    // headless…), `speak` ne dit rien et n'émet rien : on n'attend pas.
    if (!synth.getVoices().length) return;
    if (role === "cpu") this.recastCpu();
    for (const part of parts) {
      if (seq !== this.seq) return;
      if (part === null) await bleep();
      else if (part.trim()) await this.utter(part, role);
    }
  }

  private utter(text: string, role: VoiceRole): Promise<void> {
    const synth = window.speechSynthesis;
    const { voice, pitch, rate, volume = 1 } = this.cast[role];
    const utterance = new SpeechSynthesisUtterance(text.replace(/…$/, ""));
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? this.lang;
    utterance.pitch = pitch;
    utterance.rate = rate;
    utterance.volume = volume;
    return new Promise((resolve) => {
      const cap = Math.min(12_000, 1200 + (text.length * 75) / rate);
      const timer = setTimeout(resolve, cap);
      // Une lecture qui n'a pas commencé au bout d'1,5 s ne commencera pas.
      const watchdog = setTimeout(() => {
        synth.cancel();
        done();
      }, 1500);
      const done = () => {
        clearTimeout(timer);
        clearTimeout(watchdog);
        resolve();
      };
      utterance.onstart = () => clearTimeout(watchdog);
      utterance.onend = done;
      utterance.onerror = done;
      synth.speak(utterance);
    });
  }

  cancel(): void {
    this.seq++;
    if (BrowserVoices.supported()) window.speechSynthesis.cancel();
  }
}

// Un WAV vide, joué au clic qui lance le duel : Safari n'autorise ensuite
// l'élément audio à parler hors geste que s'il a déjà joué une fois.
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

/** Au-delà, on renonce à Google pour cette réplique et la voix du navigateur la lit. */
const GOOGLE_TIMEOUT_MS = 6000;

/** Coupe un texte trop long pour Google, entre deux mots. */
export function chunkText(text: string, max = GOOGLE_TTS_MAX): string[] {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    const cut = rest.lastIndexOf(" ", max);
    const at = cut > max / 2 ? cut : max;
    chunks.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export class DuelVoices {
  private browser = new BrowserVoices();
  private el: HTMLAudioElement | null = null;
  private language = "english";
  private lastCpu = -1;
  /** Change à chaque lecture : les morceaux d'une réplique coupée ne sont plus lus. */
  private seq = 0;
  private urls: string[] = [];

  static supported(): boolean {
    const google = typeof Audio !== "undefined" && typeof OfflineAudioContext !== "undefined";
    return typeof window !== "undefined" && (google || BrowserVoices.supported());
  }

  /** À appeler dans un geste utilisateur, avant la première réplique. */
  unlock(): void {
    if (typeof Audio === "undefined") return;
    const el = (this.el ??= new Audio());
    el.src = SILENCE;
    el.play().catch(() => {});
  }

  /** Prépare un nouveau duel, dans la langue des reviews. */
  recast(steamLanguage: string): void {
    this.language = steamLanguage;
    this.lastCpu = -1;
    this.browser.recast(steamLanguage);
  }

  /** Le timbre de la réplique : normal pour le joueur, jamais deux fois le même de suite pour l'ordinateur. */
  private presetFor(role: VoiceRole): VoicePreset {
    if (role === "player") return PLAYER_PRESET;
    let index = Math.floor(Math.random() * CPU_PRESETS.length);
    if (index === this.lastCpu) index = (index + 1) % CPU_PRESETS.length;
    this.lastCpu = index;
    return CPU_PRESETS[index];
  }

  private async render(text: string, preset: VoicePreset): Promise<RenderedVoice> {
    const query = new URLSearchParams({ lang: this.language, text });
    const response = await fetch(`/api/battle/gtts?${query}`);
    if (!response.ok) throw new Error(`google ${response.status}`);
    return renderVoice(await decodeVoice(await response.arrayBuffer()), preset);
  }

  /**
   * Lit une réplique et rend une promesse tenue à la fin de la lecture — ou
   * au plus tard après sa durée prévue : le duel ne doit pas rester suspendu
   * à une voix muette.
   */
  speak(text: string, role: VoiceRole): Promise<void> {
    return this.speakParts([text], role, () => Promise.resolve());
  }

  /**
   * Lit une réplique en morceaux, avec le même timbre d'un bout à l'autre ;
   * entre deux morceaux marqués `null`, `bleep` joue le bip de censure et
   * rend la main à la fin de celui-ci. Une lecture lancée entre-temps (ou
   * `cancel`) interrompt la suite.
   */
  async speakParts(parts: (string | null)[], role: VoiceRole, bleep: () => Promise<void>): Promise<void> {
    this.cancel();
    const seq = this.seq;
    const preset = this.presetFor(role);
    const pieces = parts.flatMap((part) => (part === null ? [null] : chunkText(part)));

    let voices: (RenderedVoice | null)[];
    try {
      if (typeof OfflineAudioContext === "undefined" || !this.el) throw new Error("no audio");
      voices = await withTimeout(
        Promise.all(pieces.map((piece) => (piece === null ? null : this.render(piece, preset)))),
        GOOGLE_TIMEOUT_MS,
      );
    } catch {
      if (seq === this.seq) await this.browser.speakParts(parts, role, bleep);
      return;
    }
    const urls = voices.flatMap((voice) => (voice ? [voice.url] : []));
    if (seq !== this.seq) {
      urls.forEach((url) => URL.revokeObjectURL(url));
      return;
    }
    this.urls = urls;

    // Une seule vitesse pour toute la réplique, d'après sa longueur totale.
    const total = voices.reduce((sum, voice) => sum + (voice?.duration ?? 0), 0);
    const speed = autoSpeed(total, MAX_NORMAL_S, MAX_SPEED, BASE_SPEED);
    for (let i = 0; i < voices.length; i++) {
      if (seq !== this.seq) return;
      const voice = voices[i];
      if (!voice) {
        await bleep();
        continue;
      }
      if (!(await this.play(voice, speed, preset.volume ?? 1))) {
        // Lecture refusée : la voix du navigateur reprend là où on en était.
        if (seq === this.seq) await this.browser.speakParts(pieces.slice(i), role, bleep);
        return;
      }
    }
  }

  private play(voice: RenderedVoice, speed: number, volume: number): Promise<boolean> {
    const el = this.el!;
    el.src = voice.url;
    el.preservesPitch = true;
    el.playbackRate = el.defaultPlaybackRate = voice.rateFor(speed);
    el.volume = volume;
    return new Promise((resolve) => {
      const done = (ok: boolean) => {
        clearTimeout(timer);
        el.onended = el.onerror = el.onpause = null;
        resolve(ok);
      };
      const timer = setTimeout(() => done(true), (voice.renderedDuration / el.playbackRate) * 1000 + 1500);
      el.onended = () => done(true);
      // `cancel` met en pause : la réplique est finie pour le duel.
      el.onpause = () => done(true);
      el.onerror = () => done(false);
      el.play().catch(() => done(false));
    });
  }

  cancel(): void {
    this.seq++;
    this.el?.pause();
    this.urls.forEach((url) => URL.revokeObjectURL(url));
    this.urls = [];
    this.browser.cancel();
  }
}

/** Charge la liste des voix, que Chrome remplit en différé. */
export function warmUpVoices(onReady: () => void): () => void {
  if (!BrowserVoices.supported()) return () => {};
  const synth = window.speechSynthesis;
  if (synth.getVoices().length) onReady();
  synth.addEventListener?.("voiceschanged", onReady);
  return () => synth.removeEventListener?.("voiceschanged", onReady);
}
