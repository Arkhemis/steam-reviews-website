// Les voix du battle : chaque review lancée est lue à voix haute par la
// synthèse vocale du navigateur (Web Speech API). Rien à télécharger ni à
// payer, mais la distribution dépend de l'OS : on prend ce qu'il propose.
//
// Le joueur garde la même voix normale tout le duel ; l'ordinateur change de
// voix et de timbre à chaque réplique, de la souris sous hélium au démon. Le
// genre des voix est tiré au sort, deviné d'après leur nom : l'API ne
// l'expose pas.

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

type Casting = { voice: SpeechSynthesisVoice | null; pitch: number; rate: number };

// `female` contient `male` : on teste toujours les voix féminines d'abord.
const FEMALE = /female|woman|samantha|victoria|karen|moira|tessa|fiona|zira|susan|hazel|serena|allison|ava|kate|veena|libby|sonia|aria|jenny|michelle|emma|amy|joanna|salli|kimberly/i;
const MALE = /male|daniel|alex|fred|david|mark|george|guy|ryan|tom|oliver|aaron|arthur|rishi|james|christopher|eric|brian|justin|matthew/i;

function genderOf(voice: SpeechSynthesisVoice): "female" | "male" | null {
  if (FEMALE.test(voice.name)) return "female";
  if (MALE.test(voice.name)) return "male";
  return null;
}

const pickOne = <T>(list: T[]): T | undefined => list[Math.floor(Math.random() * list.length)];

/** Les timbres du méchant : hauteur (0 à 2) et débit de la synthèse. */
const CPU_STYLES: { pitch: number; rate: number }[] = [
  { pitch: 2, rate: 1.25 }, // souris sous hélium
  { pitch: 1.7, rate: 0.85 }, // aigu et traînant
  { pitch: 0.1, rate: 0.8 }, // démon
  { pitch: 0.3, rate: 1.1 }, // grave et pressé
  { pitch: 1.4, rate: 1.5 }, // commissaire-priseur
  { pitch: 0.6, rate: 0.7 }, // méchant de film, très lent
];

export class DuelVoices {
  private cast: Record<VoiceRole, Casting> = {
    player: { voice: null, pitch: 1, rate: 1.05 },
    cpu: { voice: null, pitch: 1.9, rate: 1.15 },
  };
  /** Les voix que l'ordinateur peut prendre : toutes, sauf celle du joueur quand l'OS en propose d'autres. */
  private cpuPool: SpeechSynthesisVoice[] = [];
  private lang = "en-US";
  private lastCpu: { voice: SpeechSynthesisVoice | null; style: number } = { voice: null, style: -1 };

  static supported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
  }

  /**
   * Distribue les rôles pour un nouveau duel, dans la langue des reviews.
   * Sans voix installée pour cette langue, les deux rôles restent sans voix
   * attitrée : le navigateur lit alors avec sa voix par défaut pour `lang`.
   */
  recast(steamLanguage: string): void {
    if (!DuelVoices.supported()) return;
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
    if (!DuelVoices.supported()) return Promise.resolve();
    const synth = window.speechSynthesis;
    synth.cancel();
    // Sans voix installée (Chrome sous Linux sans speech-dispatcher, navigateur
    // headless…), `speak` ne dit rien et n'émet rien : on n'attend pas.
    if (!synth.getVoices().length) return Promise.resolve();
    if (role === "cpu") this.recastCpu();
    const { voice, pitch, rate } = this.cast[role];
    const utterance = new SpeechSynthesisUtterance(text.replace(/…$/, ""));
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? this.lang;
    utterance.pitch = pitch;
    utterance.rate = rate;
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
    if (DuelVoices.supported()) window.speechSynthesis.cancel();
  }
}

/** Charge la liste des voix, que Chrome remplit en différé. */
export function warmUpVoices(onReady: () => void): () => void {
  if (!DuelVoices.supported()) return () => {};
  const synth = window.speechSynthesis;
  if (synth.getVoices().length) onReady();
  synth.addEventListener?.("voiceschanged", onReady);
  return () => synth.removeEventListener?.("voiceschanged", onReady);
}
