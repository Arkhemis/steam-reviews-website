import { autoSpeed, decodeVoice, renderVoice, type RenderedVoice } from "@/components/duel/voiceFx";
import {
  BASE_SPEED,
  CPU_PRESETS,
  MAX_NORMAL_S,
  MAX_SPEED,
  PLAYER_PRESET,
  type VoicePreset,
} from "@/components/duel/voicePresets";
import { splitSwears } from "@/lib/censored";
import { GOOGLE_TTS_MAX } from "@/lib/tts";

// Les voix du battle : chaque review lancée est lue à voix haute, d'abord par
// la synthèse vocale du navigateur (Web Speech API). Sa distribution dépend de
// l'OS : on prend ce qu'il propose, et le genre des voix est deviné d'après
// leur nom — l'API ne l'expose pas. Le joueur garde une voix normale ;
// l'ordinateur change de voix et de hauteur à chaque réplique, et la vitesse
// suit la longueur de la réplique.
//
// Sans voix pour la langue du duel, ou si la synthèse échoue, Google Traduction
// prend le relais, retravaillé dans le navigateur : hauteur et effet du preset
// (robot, caverne…), que Web Speech ne sait pas faire (voir `voiceFx.ts`).

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

// `female` contient `male` : on teste toujours les voix féminines d'abord.
const FEMALE = /female|woman|samantha|victoria|karen|moira|tessa|fiona|zira|susan|hazel|serena|allison|ava|kate|veena|libby|sonia|aria|jenny|michelle|emma|amy|joanna|salli|kimberly/i;
const MALE = /male|daniel|alex|fred|david|mark|george|guy|ryan|tom|oliver|aaron|arthur|rishi|james|christopher|eric|brian|justin|matthew/i;

function genderOf(voice: SpeechSynthesisVoice): "female" | "male" | null {
  if (FEMALE.test(voice.name)) return "female";
  if (MALE.test(voice.name)) return "male";
  return null;
}

const pickOne = <T>(list: T[]): T | undefined => list[Math.floor(Math.random() * list.length)];

/** Hauteur d'un preset (facteur de lecture, 1 = normale) → hauteur Web Speech (0 à 2, 1 = normale). */
export function speechPitch(factor: number): number {
  return Math.min(2, Math.max(0, 1 + Math.log2(factor) * 1.25));
}

/** Débit d'une voix de synthèse à vitesse 1, pour estimer la durée d'une réplique. */
const CHARS_PER_SECOND = 14;

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;

/**
 * La longueur d'un texte en caractères latins équivalents : un idéogramme, un
 * kana ou une syllabe hangûl se lit environ trois fois moins vite qu'une lettre.
 */
function spokenLength(text: string): number {
  return text.length + 2 * (text.match(CJK)?.length ?? 0);
}

type Style = { voice: SpeechSynthesisVoice | null; pitch: number; rate: number; volume: number };

/** Un morceau de réplique ; `swear` : un gros mot, lu au ralenti. */
export type SpeechPart = { text: string; swear?: boolean };

/**
 * Les morceaux d'une réplique tels que la voix les lit. Censurée, chaque gros
 * mot devient un bip (`null`) : les séries de cœurs comme ceux écrits en clair.
 */
export function quoteParts(text: string, language: string, censored: boolean): (SpeechPart | null)[] {
  return splitSwears(text, language).map((s) => (s.swear && censored ? null : { text: s.text, swear: s.swear }));
}

/** Un événement de lecture, pour le banc de débogage de /sounds. */
export type VoiceDebugEvent = {
  at: number;
  engine: "browser" | "google";
  event: string;
  part?: number;
  text?: string;
  swear?: boolean;
  detail?: string;
};

/** Réglages de débogage : moteur et timbre imposés, journal des événements. */
export type VoiceDebug = {
  engine?: "browser" | "google";
  preset?: VoicePreset;
  log: (event: Omit<VoiceDebugEvent, "at">) => void;
};

// Le ralenti comique des gros mots : une bande qu'on freine, plus lente et
// plus grave. Web Speech ne sait que baisser le débit et la hauteur ; la voix
// de Google, elle, est vraiment rejouée plus lentement, hauteur comprise.
const SWEAR_TAPE = 0.72;
const SWEAR_RATE = 0.6;

/** La voix par défaut : la synthèse vocale du navigateur. */
class BrowserVoices {
  private playerVoice: SpeechSynthesisVoice | null = null;
  /** Les voix que l'ordinateur peut prendre : toutes, sauf celle du joueur quand l'OS en propose d'autres. */
  private cpuPool: SpeechSynthesisVoice[] = [];
  private lastCpuVoice: SpeechSynthesisVoice | null = null;
  /** Le journal de débogage, quand /sounds en demande un. */
  log: VoiceDebug["log"] | null = null;
  private steamLanguage = "english";
  private lang = "en-US";
  /** Change à chaque lecture : les morceaux d'une réplique coupée ne sont plus lus. */
  private seq = 0;

  static supported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
  }

  /**
   * Une voix installée parle-t-elle la langue du duel ? Sans voix du tout
   * (Chrome sous Linux sans speech-dispatcher, navigateur headless…) ou sans
   * voix pour cette langue, Google lit à la place.
   */
  canSpeak(): boolean {
    return BrowserVoices.supported() && voicesFor(window.speechSynthesis.getVoices(), this.lang).length > 0;
  }

  /** Distribue les voix pour un nouveau duel, dans la langue des reviews. */
  recast(steamLanguage: string): void {
    this.steamLanguage = steamLanguage;
    this.lang = SPEECH_LANG[steamLanguage] ?? "en-US";
    if (!BrowserVoices.supported()) return;
    const pool = voicesFor(window.speechSynthesis.getVoices(), this.lang);
    const byGender = (g: "female" | "male") => pool.filter((v) => genderOf(v) === g);
    const playerGender = Math.random() < 0.5 ? "female" : "male";
    this.playerVoice = pickOne(byGender(playerGender)) ?? pickOne(pool) ?? null;
    const others = pool.filter((v) => v !== this.playerVoice);
    this.cpuPool = others.length ? others : pool;
    this.lastCpuVoice = null;
  }

  /** L'ordinateur change de voix à chaque réplique, quand l'OS en propose plusieurs. */
  private nextCpuVoice(): SpeechSynthesisVoice | null {
    const fresh = this.cpuPool.filter((v) => v !== this.lastCpuVoice);
    this.lastCpuVoice = pickOne(fresh.length ? fresh : this.cpuPool) ?? null;
    return this.lastCpuVoice;
  }

  /**
   * Lit une réplique en morceaux, avec la même voix d'un bout à l'autre, les
   * gros mots au ralenti ; entre deux morceaux marqués `null`, `bleep` joue le
   * bip de censure. Rend
   * `null` si la réplique a été lue (ou coupée par une autre), sinon l'indice
   * du morceau que la synthèse n'a pas pu lire : la suite revient à Google.
   */
  async speakParts(
    parts: (SpeechPart | null)[],
    role: VoiceRole,
    preset: VoicePreset,
    bleep: () => Promise<void>,
  ): Promise<number | null> {
    if (!this.canSpeak()) return 0;
    // Chrome remplit sa liste de voix en différé : elle a pu arriver après `recast`.
    if (!this.cpuPool.length) this.recast(this.steamLanguage);
    const synth = window.speechSynthesis;
    synth.cancel();
    const seq = ++this.seq;
    const chars = parts.reduce((sum, part) => sum + (part ? spokenLength(part.text) : 0), 0);
    const style: Style = {
      voice: role === "player" ? this.playerVoice : this.nextCpuVoice(),
      pitch: speechPitch(preset.pitch),
      rate: autoSpeed(chars / CHARS_PER_SECOND, MAX_NORMAL_S, MAX_SPEED, BASE_SPEED),
      volume: preset.volume ?? 1,
    };
    const swearStyle: Style = { ...style, pitch: speechPitch(preset.pitch * SWEAR_TAPE), rate: style.rate * SWEAR_RATE };
    for (let start = 0; start < parts.length; ) {
      if (seq !== this.seq) return null;
      if (parts[start] === null) {
        await bleep();
        start++;
        continue;
      }
      // Les morceaux qui se suivent sans bip partent d'un coup dans la file du
      // moteur : il les enchaîne sans le blanc qu'on entendrait en attendant
      // la fin de l'un pour lancer l'autre (avant un gros mot, par exemple).
      let end = start;
      while (end < parts.length && parts[end] !== null) end++;
      const run = parts.slice(start, end) as SpeechPart[];
      const queued = run.map((part) =>
        part.text.trim() ? this.enqueue(part, part.swear ? swearStyle : style, start + run.indexOf(part)) : null,
      );
      for (let i = 0; i < queued.length; i++) {
        const item = queued[i];
        if (!item) continue;
        if (!(await item.finished())) {
          synth.cancel();
          return seq === this.seq ? start + i : null;
        }
        if (seq !== this.seq) return null;
      }
      start = end;
    }
    return null;
  }

  /**
   * Met un morceau dans la file du moteur. `finished` rend `false` s'il n'a
   * pas pu être lu ; elle tombe au plus tard après une durée estimée : certains
   * moteurs n'émettent jamais `end`, et le duel ne doit pas rester suspendu à
   * une voix muette. À appeler dans l'ordre : chaque attente démarre quand la
   * précédente est finie.
   */
  private enqueue(
    { text, swear }: SpeechPart,
    { voice, pitch, rate, volume }: Style,
    part: number,
  ): { finished: () => Promise<boolean> } {
    const synth = window.speechSynthesis;
    const log = (event: string, detail?: string) => this.log?.({ engine: "browser", event, part, text, swear, detail });
    const utterance = new SpeechSynthesisUtterance(text.replace(/…$/, ""));
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? this.lang;
    utterance.pitch = pitch;
    utterance.rate = rate;
    utterance.volume = volume;
    let started = false;
    let settle: (ok: boolean) => void = () => {};
    const ended = new Promise<boolean>((resolve) => (settle = resolve));
    utterance.onstart = () => {
      started = true;
      log("start", `${voice?.name ?? "default voice"} · rate ${rate.toFixed(2)} · pitch ${pitch.toFixed(2)}`);
    };
    utterance.onend = () => {
      log("end");
      settle(true);
    };
    // Une lecture coupée (`cancel`, réplique suivante) n'est pas un échec.
    utterance.onerror = (event) => {
      log("error", event.error);
      settle(event.error === "interrupted" || event.error === "canceled");
    };
    log("queued");
    synth.speak(utterance);
    return {
      finished: () =>
        new Promise((resolve) => {
          const done = (ok: boolean) => {
            clearTimeout(cap);
            clearTimeout(watchdog);
            resolve(ok);
          };
          const cap = setTimeout(() => done(true), Math.min(12_000, 1200 + (spokenLength(text) * 75) / rate));
          // Un morceau qui n'a pas commencé 1,5 s après son tour ne commencera pas.
          const watchdog = setTimeout(() => {
            if (started) return;
            log("watchdog", "never started");
            done(false);
          }, 1500);
          void ended.then(done);
        }),
    };
  }

  cancel(): void {
    this.seq++;
    if (BrowserVoices.supported()) window.speechSynthesis.cancel();
  }
}

// Un WAV vide, joué au clic qui lance le duel : Safari n'autorise ensuite
// l'élément audio à parler hors geste que s'il a déjà joué une fois.
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

/** Au-delà, Google ne lira pas cette réplique. */
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
  /** Le banc de débogage de /sounds : moteur et timbre imposés, journal des événements. */
  debug: VoiceDebug | null = null;

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
    return this.speakParts([{ text }], role, () => Promise.resolve());
  }

  /**
   * Lit une réplique en morceaux, avec le même timbre d'un bout à l'autre, les
   * gros mots au ralenti ; entre deux morceaux marqués `null`, `bleep` joue le
   * bip de censure et
   * rend la main à la fin de celui-ci. Une lecture lancée entre-temps (ou
   * `cancel`) interrompt la suite.
   */
  async speakParts(parts: (SpeechPart | null)[], role: VoiceRole, bleep: () => Promise<void>): Promise<void> {
    this.cancel();
    const seq = this.seq;
    const preset = this.debug?.preset ?? this.presetFor(role);
    this.browser.log = this.debug?.log ?? null;
    const engine = this.debug?.engine;
    const failedAt = engine === "google" ? 0 : await this.browser.speakParts(parts, role, preset, bleep);
    if (engine === "browser") {
      if (failedAt !== null) this.debug?.log({ engine: "browser", event: "failed", part: failedAt, detail: "no Google fallback in this mode" });
      return;
    }
    if (failedAt !== null) this.debug?.log({ engine: "google", event: "fallback", part: failedAt });
    if (failedAt !== null && seq === this.seq) await this.speakGoogle(parts.slice(failedAt), preset, bleep, seq);
  }

  /** La même réplique par Google, retravaillée avec la hauteur et l'effet du preset. */
  private async speakGoogle(
    parts: (SpeechPart | null)[],
    preset: VoicePreset,
    bleep: () => Promise<void>,
    seq: number,
  ): Promise<void> {
    const log = (event: string, piece?: { text: string; swear?: boolean }, detail?: string, part?: number) =>
      this.debug?.log({ engine: "google", event, part, text: piece?.text, swear: piece?.swear, detail });
    if (typeof OfflineAudioContext === "undefined" || !this.el) {
      log("unavailable", undefined, "no OfflineAudioContext or audio element not unlocked");
      return;
    }
    const pieces = parts.flatMap((part) =>
      part === null ? [null] : chunkText(part.text).map((text) => ({ text, swear: part.swear })),
    );
    const renders = pieces.map(async (piece, i) => {
      if (piece === null) return null;
      log("fetch", piece, undefined, i);
      const voice = await this.render(piece.text, preset);
      log("rendered", piece, `${voice.duration.toFixed(2)} s raw → ${voice.renderedDuration.toFixed(2)} s rendered`, i);
      return voice;
    });
    let voices: (RenderedVoice | null)[];
    try {
      voices = await withTimeout(Promise.all(renders), GOOGLE_TIMEOUT_MS);
    } catch (error) {
      log("failed", undefined, error instanceof Error ? error.message : String(error));
      // Les rendus qui aboutissent quand même ne seront pas lus : on libère leurs fichiers.
      void Promise.allSettled(renders).then((results) =>
        results.forEach((result) => result.status === "fulfilled" && result.value && URL.revokeObjectURL(result.value.url)),
      );
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
      const piece = pieces[i];
      if (!voice || !piece) {
        await bleep();
        continue;
      }
      const swear = Boolean(piece.swear);
      const rate = swear ? SWEAR_TAPE : voice.rateFor(speed);
      log("play", piece, `playbackRate ${rate.toFixed(2)}${swear ? " (tape)" : ` · speed ×${speed.toFixed(2)}`}`, i);
      this.el.onplaying = () => log("start", piece, undefined, i);
      const ok = await this.play(voice, speed, preset.volume ?? 1, swear);
      this.el.onplaying = null;
      log(ok ? "end" : "error", piece, undefined, i);
      if (!ok) return;
    }
  }

  private play(voice: RenderedVoice, speed: number, volume: number, swear: boolean): Promise<boolean> {
    const el = this.el!;
    el.src = voice.url;
    // Un gros mot passe au ralenti de bande : plus lent et plus grave à la fois.
    el.preservesPitch = !swear;
    el.playbackRate = el.defaultPlaybackRate = swear ? SWEAR_TAPE : voice.rateFor(speed);
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
