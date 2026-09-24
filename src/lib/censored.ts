import type { LanguageKey } from "@/lib/map";

// Steam masque les gros mots des reviews sous des « ♥♥♥♥ », un cœur par
// lettre. Le battle, lui, les rend : chaque série de cœurs devient un gros mot
// de la langue des reviews, de la même longueur autant que possible — ♥♥♥♥♥♥♥
// redevient souvent « fucking ». Ceux que Steam a laissés passer sont traités
// pareil : arc-en-ciel, ralenti de la voix, et cœurs et bip une fois censurés.

export const SWEARS: Record<LanguageKey, string[]> = {
  arabic: ["زفت", "خرا", "تبا", "لعنة", "حمار", "كلب"],
  bulgarian: ["лайно", "курва", "копеле", "шибан", "гъз", "путка"],
  schinese: ["狗屎", "他妈的", "妈的", "垃圾", "卧槽", "傻逼"],
  tchinese: ["狗屎", "他媽的", "媽的", "垃圾", "靠北", "白痴"],
  czech: ["hovno", "kurva", "sračka", "prdel", "debil", "zkurvysyn"],
  danish: ["lort", "fanden", "pis", "satans", "helvede", "skide", "røv"],
  dutch: ["kut", "klote", "godverdomme", "verdomme", "tering", "klootzak", "lul"],
  english: [
    "shit",
    "fuck",
    "crap",
    "damn",
    "piss",
    "dick",
    "bitch",
    "ass",
    "fucking",
    "shitty",
    "fucked",
    "bullshit",
    "asshole",
    "bastard",
    "goddamn",
    "dumbass",
    "motherfucker",
  ],
  finnish: ["paska", "vittu", "perkele", "saatana", "helvetti", "kusipää", "jumalauta"],
  french: ["merde", "putain", "connard", "bordel", "salope", "enculé", "chiant", "con", "pute", "chier"],
  german: ["Scheiße", "Mist", "Kacke", "Arschloch", "verdammt", "Scheiß", "Wichser", "Hurensohn", "Fick"],
  greek: ["σκατά", "γαμώτο", "μαλάκα", "γαμημένο", "πουτάνα"],
  hungarian: ["szar", "kurva", "bazmeg", "picsa", "fasz", "geci"],
  italian: ["merda", "cazzo", "stronzo", "vaffanculo", "minchia", "coglione", "porca"],
  japanese: ["クソ", "くそ", "ちくしょう", "糞", "ふざけんな", "死ね", "馬鹿"],
  koreana: ["개똥", "씨발", "병신", "젠장", "개새끼", "좆"],
  norwegian: ["dritt", "faen", "helvete", "jævla", "satan", "drittsekk", "pikk"],
  polish: ["gówno", "kurwa", "cholera", "pierdolę", "chuj", "dupa", "jebać", "spierdalaj"],
  portuguese: ["merda", "caralho", "foda", "porra", "cabrão", "puta", "foda-se"],
  brazilian: ["merda", "porra", "caralho", "foda", "bosta", "puta", "cacete", "desgraça"],
  romanian: ["căcat", "dracu", "rahat", "pula", "nasol", "futu-i"],
  russian: ["говно", "блять", "сука", "хуй", "пиздец", "дерьмо", "мудак", "хрен"],
  spanish: ["mierda", "joder", "coño", "cabrón", "puta", "gilipollas", "hostia"],
  latam: ["mierda", "pendejo", "chingada", "verga", "cabrón", "pinche", "carajo", "puta"],
  swedish: ["skit", "fan", "jävla", "helvete", "jävlar", "satan", "kuk", "skitsnack"],
  thai: ["เหี้ย", "ควาย", "สัส", "แม่ง", "ห่า"],
  turkish: ["bok", "siktir", "amk", "kahretsin", "lanet", "orospu"],
  ukrainian: ["лайно", "бля", "сука", "хрін", "дідько", "курва", "гівно"],
  vietnamese: ["cứt", "đéo", "địt", "đm", "vãi", "chó chết", "đồ ngu"],
};

/** Les langues écrites sans espaces (ou à particules collées) : un gros mot s'y cherche n'importe où. */
const NO_WORD_BREAKS = new Set<string>(["schinese", "tchinese", "japanese", "koreana", "thai"]);

const HEARTS = /♥+/g;

const graphemeCount = (text: string) => [...new Intl.Segmenter().segment(text)].length;

/**
 * Le gros mot qui remplace une série de cœurs : celui qui a autant de lettres
 * que de cœurs, sinon le plus proche en longueur, le premier de la liste à
 * égalité. L'anglais sert pour une langue inconnue.
 */
export function insultFor(language: string, hearts = "♥♥♥♥"): string {
  const swears = SWEARS[language as LanguageKey] ?? SWEARS.english;
  const want = hearts.length;
  let best = swears[0];
  for (const swear of swears) {
    if (Math.abs(graphemeCount(swear) - want) < Math.abs(graphemeCount(best) - want)) best = swear;
  }
  return best;
}

/**
 * Un passage du texte. Un gros mot est `censored` : série de cœurs de Steam
 * rendue en gros mot, ou gros mot écrit en clair ; `hearts` est ce qu'affiche
 * la version censurée (la série d'origine, ou un cœur par lettre).
 */
export type CensoredSegment = { text: string; censored: false } | { text: string; censored: true; hearts: string };

/**
 * Découpe un texte entre passages normaux et gros mots : les séries de cœurs
 * de Steam, remplacées par un gros mot, et ceux que Steam a laissés passer,
 * traités de la même façon (arc-en-ciel, cœurs et bip une fois censurés).
 */
export function splitCensored(text: string, language: string): CensoredSegment[] {
  const segments: CensoredSegment[] = [];
  const plain = (chunk: string) => {
    let last = 0;
    for (const match of chunk.matchAll(swearPattern(language))) {
      if (match.index > last) segments.push({ text: chunk.slice(last, match.index), censored: false });
      segments.push({ text: match[0], censored: true, hearts: "♥".repeat(graphemeCount(match[0])) });
      last = match.index + match[0].length;
    }
    if (last < chunk.length) segments.push({ text: chunk.slice(last), censored: false });
  };
  let last = 0;
  for (const match of text.matchAll(HEARTS)) {
    if (match.index > last) plain(text.slice(last, match.index));
    segments.push({ text: insultFor(language, match[0]), censored: true, hearts: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) plain(text.slice(last));
  return segments;
}

/** Vrai si le texte contient un gros mot : série de cœurs de Steam ou gros mot écrit en clair. */
export function hasSwear(text: string, language: string): boolean {
  return splitCensored(text, language).some((segment) => segment.censored);
}

/** Le texte avec ses cœurs remplacés. */
export function uncensor(text: string, language: string): string {
  return splitCensored(text, language)
    .map((segment) => segment.text)
    .join("");
}

const escape = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Les lettres latines et leurs variantes accentuées : une review en capitales perd souvent ses accents. */
const LATIN_VARIANTS: Record<string, string> = {
  a: "aàáâãäå",
  c: "cç",
  e: "eéèêë",
  i: "iíìîï",
  n: "nñ",
  o: "oóòôõö",
  u: "uúùûü",
  y: "yýÿ",
};

/** Une lettre accentuée ramenée à sa base : é → e, ç → c. */
const latinBase = (char: string) => char.normalize("NFD").replace(/\p{M}/gu, "");

/**
 * Le motif d'un gros mot : accents indifférents pour les lettres latines
 * (« ENCULES » pour « enculé ») et pluriel en -s ou -es pour un mot latin de
 * plus de trois lettres (« connards », « shits »). Les autres écritures se
 * cherchent telles quelles.
 */
function wordPattern(word: string): string {
  const latin = /^[\p{Script=Latin}\s'-]+$/u.test(word);
  const body = [...word]
    .map((char) => {
      const base = latinBase(char).toLowerCase();
      return /\p{Script=Latin}/u.test(char) && LATIN_VARIANTS[base] ? `[${LATIN_VARIANTS[base]}]` : escape(char);
    })
    .join("");
  // Pas de pluriel pour les mots de trois lettres : « fan » (suédois) ne doit pas attraper « fans ».
  return latin && [...word].length > 3 ? `${body}(?:e?s)?` : body;
}
const swearPatterns = new Map<string, RegExp>();

/** Les gros mots écrits en clair : ceux de la langue, plus les jurons anglais qu'on croise partout. */
function swearPattern(language: string): RegExp {
  let pattern = swearPatterns.get(language);
  if (!pattern) {
    const alternation = (list: string[]) =>
      [...new Set(list)]
        .sort((a, b) => b.length - a.length)
        .map(wordPattern)
        .join("|");
    const native = SWEARS[language as LanguageKey] ?? [];
    // Hors langues sans espaces, un gros mot doit être un mot entier : « class » n'a rien à cacher.
    // Dans celles-ci, les gros mots de la langue se cherchent partout, mais un
    // juron anglais reste un mot latin entier : « classic » n'y cache rien non plus.
    if (NO_WORD_BREAKS.has(language)) {
      const english = alternation(SWEARS.english.filter((word) => !native.includes(word)));
      pattern = new RegExp(`(?:${alternation(native)})|(?<!\\p{Script=Latin})(?:${english})(?!\\p{Script=Latin})`, "giu");
    } else {
      const words = alternation([...native, ...SWEARS.english]);
      pattern = new RegExp(`(?<![\\p{L}\\p{M}])(?:${words})(?![\\p{L}\\p{M}])`, "giu");
    }
    swearPatterns.set(language, pattern);
  }
  return pattern;
}

/** Un passage de réplique tel que la voix le lit. `swear` : un gros mot, lu au ralenti (un bip s'il est censuré). */
export type SpokenSegment = { text: string; swear: boolean };

/** Découpe une réplique entre texte courant et gros mots, pour la voix. */
export function splitSwears(text: string, language: string): SpokenSegment[] {
  return splitCensored(text, language).map((segment) => ({ text: segment.text, swear: segment.censored }));
}
