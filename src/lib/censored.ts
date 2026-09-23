import type { LanguageKey } from "@/lib/map";

// Steam masque les gros mots des reviews sous des « ♥♥♥♥ ». Le battle, lui,
// les rend : chaque série de cœurs devient une insulte dans la langue des
// reviews lancées.

export const INSULTS: Record<LanguageKey, string> = {
  arabic: "زفت",
  bulgarian: "лайно",
  schinese: "狗屎",
  tchinese: "狗屎",
  czech: "hovno",
  danish: "lort",
  dutch: "kut",
  english: "shit",
  finnish: "paska",
  french: "merde",
  german: "Scheiße",
  greek: "σκατά",
  hungarian: "szar",
  italian: "merda",
  japanese: "クソ",
  koreana: "개똥",
  norwegian: "dritt",
  polish: "gówno",
  portuguese: "merda",
  brazilian: "merda",
  romanian: "căcat",
  russian: "говно",
  spanish: "mierda",
  latam: "mierda",
  swedish: "skit",
  thai: "ขี้",
  turkish: "bok",
  ukrainian: "лайно",
  vietnamese: "cứt",
};

const HEARTS = /♥+/g;

/** L'insulte d'une langue Steam, l'anglaise pour une langue inconnue. */
export function insultFor(language: string): string {
  return INSULTS[language as LanguageKey] ?? INSULTS.english;
}

/** Un passage du texte ; pour une série de cœurs, `hearts` garde la série d'origine. */
export type CensoredSegment = { text: string; censored: false } | { text: string; censored: true; hearts: string };

/** Découpe un texte entre passages normaux et séries de cœurs remplacées par l'insulte. */
export function splitCensored(text: string, language: string): CensoredSegment[] {
  const insult = insultFor(language);
  const segments: CensoredSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(HEARTS)) {
    if (match.index > last) segments.push({ text: text.slice(last, match.index), censored: false });
    segments.push({ text: insult, censored: true, hearts: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), censored: false });
  return segments;
}

/** Le texte avec ses cœurs remplacés, pour la synthèse vocale. */
export function uncensor(text: string, language: string): string {
  return text.replace(HEARTS, insultFor(language));
}
