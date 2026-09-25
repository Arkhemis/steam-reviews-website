import { describe, expect, it } from "vitest";
import type { GameStats } from "@/lib/data/types";
import { buildLibrary, libraryInsights } from "@/lib/library";
import type { OwnedGame } from "@/lib/steamApi";

function owned(appId: number, playtimeMinutes: number): OwnedGame {
  return { appId, name: `Game ${appId}`, playtimeMinutes, playtime2WeeksMinutes: 0, lastPlayedAt: null };
}

function stats(appId: number, pctPositive: number, totalReviews = 1000, playtimeMedianMinutes = 600): GameStats {
  return {
    appId,
    name: `Game ${appId}`,
    genres: [],
    developers: [],
    publishers: [],
    coverUrl: null,
    firstReleaseDate: null,
    totalReviews,
    reviewScore: 0,
    pctPositive,
    playtimeMedianMinutes,
    pctSteamDeck: 0,
    pctRefunded: 0,
  };
}

const catalogue = new Map([
  [1, stats(1, 0.95)],
  [2, stats(2, 0.6)],
  [3, stats(3, 0.98)],
  [4, stats(4, 0.99, 10)],
  [5, stats(5, 0.85)],
]);

// 1 : très joué et adoré ; 2 : « Mixed », joué quand même ; 3 et 4 : jamais
// lancés, 4 avec trop peu d'avis ; 5 : essayé une heure ; 6 : hors catalogue.
const library = buildLibrary(
  [owned(1, 6000), owned(2, 1200), owned(3, 0), owned(4, 0), owned(5, 60), owned(6, 300)],
  catalogue,
);

describe("libraryInsights", () => {
  const insights = libraryInsights(library);

  it("compte jeux, jeux lancés, temps total et couverture du catalogue", () => {
    expect(insights.gameCount).toBe(6);
    expect(insights.playedCount).toBe(4);
    expect(insights.totalPlaytimeMinutes).toBe(7560);
    expect(insights.ratedCount).toBe(5);
  });

  it("pondère la note par le temps de jeu, les jeux hors catalogue et jamais lancés exclus", () => {
    expect(insights.playtimeWeightedScore).toBeCloseTo((0.95 * 6000 + 0.6 * 1200 + 0.85 * 60) / 7260);
    expect(insights.meanScore).toBeCloseTo((0.95 + 0.6 + 0.98 + 0.99 + 0.85) / 5);
  });

  it("range les verdicts dans l'ordre de Steam", () => {
    expect(insights.verdicts.map((verdict) => [verdict.label, verdict.count])).toEqual([
      ["Overwhelmingly Positive", 3],
      ["Positive", 1],
      ["Mixed", 1],
    ]);
  });

  it("classe les plus joués par temps de jeu, sans les jeux jamais lancés", () => {
    expect(insights.mostPlayed.map((game) => game.appId)).toEqual([1, 2, 6, 5]);
  });

  it("ne garde dans le backlog que les jamais lancés assez commentés", () => {
    expect(insights.backlogBest.map((game) => game.appId)).toEqual([3]);
  });

  it("repère les jeux mal notés où l'on a passé des heures", () => {
    expect(insights.guiltyPleasures.map((game) => game.appId)).toEqual([2]);
  });

  it("compare le temps de jeu à celui du joueur médian", () => {
    expect(insights.aheadOfCrowd.map((game) => [game.appId, game.ratio])).toEqual([
      [1, 10],
      [2, 2],
    ]);
  });

  it("classe les mieux et les moins bien notés, sans les jeux trop peu commentés", () => {
    expect(insights.bestRated.map((game) => game.appId)).toEqual([3, 1, 5, 2]);
    expect(insights.worstRated.map((game) => game.appId)).toEqual([2, 5, 1, 3]);
  });

  it("ne voit pas de temps de jeu caché dans une bibliothèque jouée", () => {
    expect(insights.playtimeHidden).toBe(false);
  });

  // « Always keep my total playtime private » : Steam rend tous les temps à 0.
  it("repère un temps de jeu caché et ne prétend pas que rien n'a été lancé", () => {
    const hidden = libraryInsights(buildLibrary([owned(1, 0), owned(2, 0), owned(3, 0)], catalogue));
    expect(hidden.playtimeHidden).toBe(true);
    expect(hidden.playtimeWeightedScore).toBeNull();
    expect(hidden.meanScore).toBeCloseTo((0.95 + 0.6 + 0.98) / 3);
    expect(hidden.bestRated.map((game) => game.appId)).toEqual([3, 1, 2]);
  });

  it("tient debout sur une bibliothèque vide", () => {
    const empty = libraryInsights([]);
    expect(empty.playtimeWeightedScore).toBeNull();
    expect(empty.meanScore).toBeNull();
    expect(empty.verdicts).toEqual([]);
    expect(empty.playtimeHidden).toBe(false);
  });
});
