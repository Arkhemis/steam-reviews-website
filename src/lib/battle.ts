import { estimateRevenue } from "@/lib/revenue";
import type { GameProfile } from "@/lib/data/types";

// Le battle se joue comme un jeu de combat : chaque statistique est un round,
// chaque round perdu retire une part fixe de la barre de vie, et le commentaire
// du round est tiré de l'écart réel entre les deux jeux. Tout est pur ici — la
// page ne fait que lire les deux fiches, le composant ne fait que rejouer.

export const DEFAULT_LEFT_APP_ID = 1086940; // Baldur's Gate III
export const DEFAULT_RIGHT_APP_ID = 1716740; // Starfield

export type Side = "left" | "right";

export type BattleRound = {
  key: string;
  /** Le nom du round, façon jeu de combat. */
  title: string;
  /** La statistique réellement comparée. */
  stat: string;
  left: string;
  right: string;
  /** Longueur des barres, de 0 à 100 : la vraie grandeur, pas une part du total. */
  leftFillPct: number;
  rightFillPct: number;
  winner: Side | null;
  /** Un écart assez large pour mériter l'étiquette. */
  critical: boolean;
  commentary: string;
};

export type BattleOutcome = {
  winner: Side | null;
  leftWins: number;
  rightWins: number;
  /** Le bandeau final : « Flawless victory », « Photo finish »… */
  verdict: string;
};

/** Ce que le combat a besoin de savoir d'un jeu. */
export type Fighter = Pick<
  GameProfile,
  "appId" | "name" | "pctPositive" | "totalReviews" | "playtimeMedianMinutes" | "pctRefunded" | "pctSteamDeck" | "store" | "firstReleaseDate"
>;

const enCompact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** « 2.3× » sous dix, « 14× » au-delà : au-dessus, la décimale n'apprend plus rien. */
export function formatRatio(ratio: number): string {
  return ratio < 10 ? `${ratio.toFixed(1)}×` : `${Math.round(ratio)}×`;
}

function ratioOf(high: number, low: number): number {
  return low > 0 ? high / low : Infinity;
}

type RoundSpec = {
  key: string;
  title: string;
  stat: string;
  left: number;
  right: number;
  format: (n: number) => string;
  higherIsBetter: boolean;
  /** Échelle des barres : 100 pour un pourcentage, le plus grand des deux sinon. */
  scaleMax?: number;
  /** Écart jugé écrasant. */
  isCritical: (winnerValue: number, loserValue: number) => boolean;
  commentary: (w: string, l: string, winnerValue: number, loserValue: number) => string;
  draw: (formatted: string) => string;
};

function round(spec: RoundSpec, leftName: string, rightName: string): BattleRound {
  const left = spec.format(spec.left);
  const right = spec.format(spec.right);
  const scaleMax = spec.scaleMax ?? 100;
  const fill = (n: number) => (scaleMax > 0 ? Math.min(100, (n / scaleMax) * 100) : 0);

  // L'égalité se juge sur les chiffres affichés : « 97 % contre 97 % » ne
  // peut pas donner un vainqueur à la troisième décimale.
  let winner: Side | null = null;
  if (left !== right && spec.left !== spec.right) {
    const leftAhead = spec.higherIsBetter ? spec.left > spec.right : spec.left < spec.right;
    winner = leftAhead ? "left" : "right";
  }

  const base = { key: spec.key, title: spec.title, stat: spec.stat, left, right, leftFillPct: fill(spec.left), rightFillPct: fill(spec.right) };
  if (!winner) return { ...base, winner, critical: false, commentary: spec.draw(left) };

  const [w, l, wv, lv] =
    winner === "left" ? [leftName, rightName, spec.left, spec.right] : [rightName, leftName, spec.right, spec.left];
  return { ...base, winner, critical: spec.isCritical(wv, lv), commentary: spec.commentary(w, l, wv, lv) };
}

function revenueOf(game: Fighter): number | null {
  if (!game.store) return null;
  return (
    estimateRevenue({
      totalReviews: game.totalReviews,
      priceUsd: game.store.priceUsd,
      isFree: game.store.isFree,
      firstReleaseDate: game.firstReleaseDate,
    })?.grossRevenueUsd ?? null
  );
}

export function buildRounds(left: Fighter, right: Fighter): BattleRound[] {
  const specs: RoundSpec[] = [
    {
      key: "score",
      title: "Crowd approval",
      stat: "positive reviews",
      left: left.pctPositive * 100,
      right: right.pctPositive * 100,
      format: (n) => `${Math.round(n)}%`,
      higherIsBetter: true,
      isCritical: (w, l) => w - l >= 15,
      commentary: (w, l, wv, lv) => {
        const gap = Math.round(wv) - Math.round(lv);
        if (gap >= 15) return `${w} flattens ${l} by ${gap} points.`;
        if (gap >= 5) return `${w} takes it by ${gap} points.`;
        return `Photo finish — ${w} edges it by ${gap} point${gap === 1 ? "" : "s"}.`;
      },
      draw: (v) => `Dead heat at ${v}. The players can't pick.`,
    },
    {
      key: "playtime",
      title: "Staying power",
      stat: "median playtime",
      left: left.playtimeMedianMinutes,
      right: right.playtimeMedianMinutes,
      format: (n) => `${Math.round(n / 60)}h`,
      higherIsBetter: true,
      scaleMax: Math.max(left.playtimeMedianMinutes, right.playtimeMedianMinutes),
      isCritical: (w, l) => ratioOf(w, l) >= 2,
      commentary: (w, l, wv, lv) => {
        const ratio = ratioOf(wv, lv);
        if (!Number.isFinite(ratio)) return `${l} players barely launch it. ${w} keeps them.`;
        if (ratio >= 1.5) return `${w} players stick around ${formatRatio(ratio)} longer.`;
        return `${w} holds on to its players ${Math.round((wv - lv) / 60)}h longer.`;
      },
      draw: (v) => `Both keep their players about ${v}. Even.`,
    },
    {
      key: "volume",
      title: "Army size",
      stat: "reviews on Steam",
      left: left.totalReviews,
      right: right.totalReviews,
      format: (n) => enCompact.format(n),
      higherIsBetter: true,
      scaleMax: Math.max(left.totalReviews, right.totalReviews),
      isCritical: (w, l) => ratioOf(w, l) >= 3,
      commentary: (w, l, wv, lv) => {
        const ratio = ratioOf(wv, lv);
        if (ratio >= 1.5) return `${w} shows up with ${formatRatio(ratio)} the army.`;
        return `${w} brings a few more reviewers to the fight.`;
      },
      draw: (v) => `Two armies of ${v}. Nobody blinks.`,
    },
    {
      key: "refunds",
      title: "Buyer's remorse",
      stat: "reviewers who refunded",
      left: left.pctRefunded * 100,
      right: right.pctRefunded * 100,
      format: (n) => `${n.toFixed(1)}%`,
      higherIsBetter: false,
      // Un taux de remboursement tient sous 10 % : sur une échelle de 100, les
      // deux barres seraient invisibles. On garde le plus haut comme bord.
      scaleMax: Math.max(left.pctRefunded, right.pctRefunded) * 100,
      isCritical: (w, l) => ratioOf(l, w) >= 2,
      commentary: (w, l, wv, lv) => {
        const ratio = ratioOf(lv, wv);
        if (!Number.isFinite(ratio)) return `Nobody refunds ${w}. ${l} can't say the same.`;
        if (ratio >= 1.5) return `${l} gets refunded ${formatRatio(ratio)} as often. Ouch.`;
        return `${w} keeps a few more of its buyers.`;
      },
      draw: (v) => `Same share of regrets on both sides: ${v}.`,
    },
    {
      key: "deck",
      title: "Handheld hero",
      stat: "played mostly on Steam Deck",
      left: left.pctSteamDeck * 100,
      right: right.pctSteamDeck * 100,
      format: (n) => `${n.toFixed(1)}%`,
      higherIsBetter: true,
      scaleMax: Math.max(left.pctSteamDeck, right.pctSteamDeck) * 100,
      isCritical: (w, l) => ratioOf(w, l) >= 2,
      commentary: (w, l, wv, lv) => {
        const ratio = ratioOf(wv, lv);
        if (!Number.isFinite(ratio)) return `${w} goes portable. ${l} stays on the desk.`;
        if (ratio >= 1.5) return `${w} is ${formatRatio(ratio)} more of a Deck staple.`;
        return `${w} travels slightly better.`;
      },
      draw: (v) => `Both at ${v} on the Deck. Nobody wins on the couch.`,
    },
  ];

  const leftRevenue = revenueOf(left);
  const rightRevenue = revenueOf(right);
  // Un jeu gratuit ou sans prix n'a pas d'estimation : le round saute plutôt
  // que d'être gagné par forfait.
  if (leftRevenue !== null && rightRevenue !== null) {
    specs.push({
      key: "revenue",
      title: "Box office",
      stat: "estimated gross revenue",
      left: leftRevenue,
      right: rightRevenue,
      format: (n) => `~${usdCompact.format(n)}`,
      higherIsBetter: true,
      scaleMax: Math.max(leftRevenue, rightRevenue),
      isCritical: (w, l) => ratioOf(w, l) >= 3,
      commentary: (w, l, wv, lv) => {
        const ratio = ratioOf(wv, lv);
        if (ratio >= 1.5) return `${w} out-earns ${l} roughly ${formatRatio(ratio)}.`;
        return `${w} sells a bit more — within the margin of the guess.`;
      },
      draw: (v) => `Both around ${v}. Split the bag.`,
    });
  }

  return specs.map((spec) => round(spec, left.name, right.name));
}

export function battleOutcome(rounds: BattleRound[]): BattleOutcome {
  const leftWins = rounds.filter((r) => r.winner === "left").length;
  const rightWins = rounds.filter((r) => r.winner === "right").length;
  const winner = leftWins === rightWins ? null : leftWins > rightWins ? "left" : "right";
  const top = Math.max(leftWins, rightWins);
  const bottom = Math.min(leftWins, rightWins);

  let verdict: string;
  if (!winner) verdict = "Double K.O.";
  else if (bottom === 0) verdict = "Flawless victory";
  else if (top - bottom === 1) verdict = "Photo finish";
  else verdict = "Decisive win";

  return { winner, leftWins, rightWins, verdict };
}

/**
 * La vie de chaque camp après les `played` premiers rounds. Un coup vaut
 * 100 / (rounds gagnés par le vainqueur) : le perdant finit pile à zéro, le
 * vainqueur garde ce que ses défaites lui ont laissé, et une égalité met les
 * deux au tapis — le double K.O. du verdict.
 */
export function healthAfter(rounds: BattleRound[], played: number): { left: number; right: number } {
  const { leftWins, rightWins } = battleOutcome(rounds);
  const top = Math.max(leftWins, rightWins);
  const hit = top > 0 ? 100 / top : 0;
  const done = rounds.slice(0, played);
  const clamp = (n: number) => Math.max(0, n);
  return {
    left: clamp(100 - done.filter((r) => r.winner === "right").length * hit),
    right: clamp(100 - done.filter((r) => r.winner === "left").length * hit),
  };
}

/** L'ordre des deux jeux tel que l'URL le demande, sans jamais opposer un jeu à lui-même. */
export function resolveMatchup(game?: string, vs?: string): { leftAppId: number; rightAppId: number } {
  const leftAppId = Number(game) || DEFAULT_LEFT_APP_ID;
  let rightAppId = Number(vs) || DEFAULT_RIGHT_APP_ID;
  if (rightAppId === leftAppId) {
    rightAppId = leftAppId === DEFAULT_LEFT_APP_ID ? DEFAULT_RIGHT_APP_ID : DEFAULT_LEFT_APP_ID;
  }
  return { leftAppId, rightAppId };
}

/** `path` : `/battle` pour les rounds, `/battle-2` pour les armées. */
export function battleHref(leftAppId: number, rightAppId: number, path = "/battle"): string {
  return `${path}?game=${leftAppId}&vs=${rightAppId}`;
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
