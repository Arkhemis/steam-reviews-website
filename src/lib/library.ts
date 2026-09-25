import type { GameStats } from "@/lib/data/types";
import type { OwnedGame } from "@/lib/steamApi";
import { getSteamRating } from "@/lib/steamRating";

// Ce que la page d'une bibliothèque raconte, calculé à partir des jeux que
// Steam dit possédés et des stats du catalogue. Tout est pur : la page fait les
// appels, ce module fait les comptes.

export type LibraryGame = OwnedGame & { stats: GameStats | null };

export type VerdictShare = { label: string; color: string; count: number; playtimeMinutes: number };

export type CrowdComparison = LibraryGame & { stats: GameStats; ratio: number };

export type LibraryInsights = {
  gameCount: number;
  playedCount: number;
  totalPlaytimeMinutes: number;
  /**
   * Aucun jeu n'a de temps de jeu : Steam le cache (« Always keep my total
   * playtime private ») ou rien n'a jamais été lancé. Les deux se lisent
   * pareil, et tout ce qui repose sur le temps de jeu tombe.
   */
  playtimeHidden: boolean;
  /** Jeux que le catalogue connaît, donc qu'on sait noter. */
  ratedCount: number;
  /** Moyenne des % positifs, pondérée par le temps passé sur chaque jeu. */
  playtimeWeightedScore: number | null;
  /** Moyenne simple des % positifs, jeu par jeu. */
  meanScore: number | null;
  verdicts: VerdictShare[];
  mostPlayed: LibraryGame[];
  backlogBest: LibraryGame[];
  guiltyPleasures: LibraryGame[];
  aheadOfCrowd: CrowdComparison[];
  bestRated: LibraryGame[];
  worstRated: LibraryGame[];
};

// Sous 50 avis, Steam lui-même ne donne qu'un « Positive » ou « Mixed » sans
// nuance : un 100 % sur huit avis ne doit pas trôner en tête du backlog.
export const MIN_REVIEWS_TO_RANK = 50;

// Une heure de jeu : en dessous, on a ouvert le jeu plus qu'on ne l'a aimé.
const MEANINGFUL_PLAYTIME_MINUTES = 60;

const LIST_SIZE = 6;
export const MOST_PLAYED_SIZE = 12;

// L'ordre de Steam, du meilleur au pire.
const VERDICT_ORDER = [
  "Overwhelmingly Positive",
  "Very Positive",
  "Positive",
  "Mostly Positive",
  "Mixed",
  "Mostly Negative",
  "Negative",
  "Very Negative",
  "Overwhelmingly Negative",
];

export function buildLibrary(owned: OwnedGame[], stats: Map<number, GameStats>): LibraryGame[] {
  return owned.map((game) => ({ ...game, stats: stats.get(game.appId) ?? null }));
}

function isRanked(game: LibraryGame): game is LibraryGame & { stats: GameStats } {
  return game.stats !== null && game.stats.totalReviews >= MIN_REVIEWS_TO_RANK;
}

export function libraryInsights(games: LibraryGame[]): LibraryInsights {
  const played = games.filter((game) => game.playtimeMinutes > 0);
  const rated = games.filter((game): game is LibraryGame & { stats: GameStats } => game.stats !== null);
  const ranked = games.filter(isRanked);

  const ratedPlayed = rated.filter((game) => game.playtimeMinutes > 0);
  const ratedPlaytime = ratedPlayed.reduce((sum, game) => sum + game.playtimeMinutes, 0);
  const playtimeWeightedScore =
    ratedPlaytime > 0
      ? ratedPlayed.reduce((sum, game) => sum + game.stats.pctPositive * game.playtimeMinutes, 0) / ratedPlaytime
      : null;
  const meanScore = rated.length > 0 ? rated.reduce((sum, game) => sum + game.stats.pctPositive, 0) / rated.length : null;

  const byVerdict = new Map<string, VerdictShare>();
  for (const game of rated) {
    const { label, color } = getSteamRating(game.stats.pctPositive, game.stats.totalReviews);
    const share = byVerdict.get(label) ?? { label, color, count: 0, playtimeMinutes: 0 };
    share.count += 1;
    share.playtimeMinutes += game.playtimeMinutes;
    byVerdict.set(label, share);
  }
  const verdicts = VERDICT_ORDER.flatMap((label) => byVerdict.get(label) ?? []);

  const byPlaytime = (a: LibraryGame, b: LibraryGame) => b.playtimeMinutes - a.playtimeMinutes;

  return {
    gameCount: games.length,
    playedCount: played.length,
    totalPlaytimeMinutes: games.reduce((sum, game) => sum + game.playtimeMinutes, 0),
    playtimeHidden: games.length > 0 && played.length === 0,
    ratedCount: rated.length,
    playtimeWeightedScore,
    meanScore,
    verdicts,
    mostPlayed: [...played].sort(byPlaytime).slice(0, MOST_PLAYED_SIZE),
    // Les mieux notés des jeux jamais lancés : de quoi choisir le prochain.
    backlogBest: ranked
      .filter((game) => game.playtimeMinutes === 0)
      .sort((a, b) => b.stats.pctPositive - a.stats.pctPositive || b.stats.totalReviews - a.stats.totalReviews)
      .slice(0, LIST_SIZE),
    // Ceux que Steam trouve moyens ou pires, et où l'on a pourtant passé des heures.
    guiltyPleasures: ranked
      .filter((game) => game.stats.pctPositive < 0.7 && game.playtimeMinutes >= MEANINGFUL_PLAYTIME_MINUTES)
      .sort(byPlaytime)
      .slice(0, LIST_SIZE),
    // Le temps passé, rapporté à celui du joueur médian qui a laissé un avis.
    aheadOfCrowd: ranked
      .filter(
        (game) =>
          game.stats.playtimeMedianMinutes >= MEANINGFUL_PLAYTIME_MINUTES &&
          game.playtimeMinutes >= 2 * MEANINGFUL_PLAYTIME_MINUTES,
      )
      .map((game) => ({ ...game, ratio: game.playtimeMinutes / game.stats.playtimeMedianMinutes }))
      .filter((game) => game.ratio > 1)
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, LIST_SIZE),
    // Les deux listes qui tiennent sans temps de jeu.
    bestRated: [...ranked]
      .sort((a, b) => b.stats.pctPositive - a.stats.pctPositive || b.stats.totalReviews - a.stats.totalReviews)
      .slice(0, LIST_SIZE),
    worstRated: [...ranked]
      .sort((a, b) => a.stats.pctPositive - b.stats.pctPositive || b.stats.totalReviews - a.stats.totalReviews)
      .slice(0, LIST_SIZE),
  };
}
