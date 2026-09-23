import type { GameProfile } from "@/lib/data/types";
import { LANGUAGE_LABELS, type LanguageKey } from "@/lib/map";

// Ce que la page battle partage avec son moteur de duel (`@/lib/duel`) : la
// paire de jeux lue dans l'URL, le lien d'un duel, et les grands classiques.

export const DEFAULT_LEFT_APP_ID = 1086940; // Baldur's Gate III
export const DEFAULT_RIGHT_APP_ID = 1716740; // Starfield

export type Side = "left" | "right";

/** La langue des reviews lancées (et lues à voix haute) : une clé de langue Steam. */
export const DEFAULT_LANGUAGE: LanguageKey = "english";

/** `?lang=` tel que l'URL le donne, ramené à une langue Steam connue. */
export function resolveLanguage(lang?: string): LanguageKey {
  return lang && lang in LANGUAGE_LABELS ? (lang as LanguageKey) : DEFAULT_LANGUAGE;
}

/** Ce que le duel a besoin de savoir d'un jeu pour en tirer ses stats. */
export type Fighter = Pick<
  GameProfile,
  "appId" | "name" | "pctPositive" | "totalReviews" | "playtimeMedianMinutes" | "pctRefunded" | "pctSteamDeck"
>;

/** L'ordre des deux jeux tel que l'URL le demande, sans jamais opposer un jeu à lui-même. */
export function resolveMatchup(game?: string, vs?: string): { leftAppId: number; rightAppId: number } {
  const leftAppId = Number(game) || DEFAULT_LEFT_APP_ID;
  let rightAppId = Number(vs) || DEFAULT_RIGHT_APP_ID;
  if (rightAppId === leftAppId) {
    rightAppId = leftAppId === DEFAULT_LEFT_APP_ID ? DEFAULT_RIGHT_APP_ID : DEFAULT_LEFT_APP_ID;
  }
  return { leftAppId, rightAppId };
}

/**
 * Sans langue, l'URL laisse le serveur choisir d'après le navigateur ; une
 * langue donnée y est toujours écrite, anglais compris, pour qu'un choix
 * explicite l'emporte sur celui du navigateur.
 */
export function battleHref(leftAppId: number, rightAppId: number, lang?: string): string {
  const suffix = lang ? `&lang=${lang}` : "";
  return `/battle?game=${leftAppId}&vs=${rightAppId}${suffix}`;
}

// Langue BCP 47 (sans région) → langue Steam. Portugais, espagnol et chinois
// dépendent aussi de la région : voir `steamLanguageOf`.
const BASE_LANGUAGES: Record<string, LanguageKey> = {
  ar: "arabic",
  bg: "bulgarian",
  cs: "czech",
  da: "danish",
  nl: "dutch",
  en: "english",
  fi: "finnish",
  fr: "french",
  de: "german",
  el: "greek",
  hu: "hungarian",
  it: "italian",
  ja: "japanese",
  ko: "koreana",
  nb: "norwegian",
  nn: "norwegian",
  no: "norwegian",
  pl: "polish",
  pt: "portuguese",
  ro: "romanian",
  ru: "russian",
  es: "spanish",
  sv: "swedish",
  th: "thai",
  tr: "turkish",
  uk: "ukrainian",
  vi: "vietnamese",
  zh: "schinese",
};

/** Une étiquette BCP 47 (« pt-BR », « zh-Hant-TW », « es-419 ») → langue Steam, ou null. */
function steamLanguageOf(tag: string): LanguageKey | null {
  const [base, ...rest] = tag.toLowerCase().split("-");
  const subtags = new Set(rest);
  if (base === "pt" && subtags.has("br")) return "brazilian";
  if (base === "zh" && (subtags.has("hant") || subtags.has("tw") || subtags.has("hk") || subtags.has("mo"))) return "tchinese";
  // Tout espagnol d'une autre région que l'Espagne est celui d'Amérique latine.
  if (base === "es" && rest.some((t) => /^(\d{3}|[a-z]{2})$/.test(t) && t !== "es")) return "latam";
  return BASE_LANGUAGES[base] ?? null;
}

/**
 * La langue Steam préférée d'après l'en-tête `Accept-Language` : la première
 * reconnue par ordre de préférence (`q`), ou null si aucune ne l'est.
 */
export function languageFromAcceptLanguage(header: string | null | undefined): LanguageKey | null {
  if (!header) return null;
  const tags = header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { tag: tag.trim(), q: q ? Number(q.slice(2)) : 1, index };
    })
    .filter((t) => t.tag && t.tag !== "*" && t.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  for (const { tag } of tags) {
    const language = steamLanguageOf(tag);
    if (language) return language;
  }
  return null;
}

export type Rivalry = {
  tagline: string;
  left: { appId: number; name: string };
  right: { appId: number; name: string };
};

// Les grands classiques, pour qui arrive sans idée de duel. Tous présents dans
// `game_stats` ; les noms sont en dur pour ne pas payer une requête par carte.
export const RIVALRIES: Rivalry[] = [
  { tagline: "the eternal MOBA-vs-shooter war", left: { appId: 570, name: "Dota 2" }, right: { appId: 730, name: "Counter-Strike 2" } },
  { tagline: "CD Projekt vs CD Projekt", left: { appId: 292030, name: "The Witcher 3: Wild Hunt" }, right: { appId: 1091500, name: "Cyberpunk 2077" } },
  { tagline: "FromSoftware family feud", left: { appId: 1245620, name: "Elden Ring" }, right: { appId: 374320, name: "Dark Souls III" } },
  { tagline: "cozy farming showdown", left: { appId: 413150, name: "Stardew Valley" }, right: { appId: 105600, name: "Terraria" } },
  { tagline: "battle royale grudge match", left: { appId: 578080, name: "PUBG: Battlegrounds" }, right: { appId: 1172470, name: "Apex Legends" } },
  { tagline: "indie darlings, fists up", left: { appId: 367520, name: "Hollow Knight" }, right: { appId: 1145360, name: "Hades" } },
  { tagline: "space is big, reviews are bigger", left: { appId: 275850, name: "No Man's Sky" }, right: { appId: 1716740, name: "Starfield" } },
  { tagline: "survival, but with friends", left: { appId: 892970, name: "Valheim" }, right: { appId: 1623730, name: "Palworld" } },
];
