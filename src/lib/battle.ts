import type { GameProfile } from "@/lib/data/types";

// Ce que la page battle partage avec son moteur de duel (`@/lib/duel`) : la
// paire de jeux lue dans l'URL, le lien d'un duel, et les grands classiques.

export const DEFAULT_LEFT_APP_ID = 1086940; // Baldur's Gate III
export const DEFAULT_RIGHT_APP_ID = 1716740; // Starfield

export type Side = "left" | "right";

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

export function battleHref(leftAppId: number, rightAppId: number): string {
  return `/battle?game=${leftAppId}&vs=${rightAppId}`;
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
