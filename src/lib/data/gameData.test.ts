import { describe, expect, it } from "vitest";
import {
  getGameLanguageDistribution,
  getGameReviewTrends,
  getGameStats,
  getGameTopReviews,
  getTopGames,
  TOP_REVIEWS_PER_SIDE,
} from "@/lib/data/gameData";

const BALDURS_GATE_3_APP_ID = 1086940;

describe("gameData", () => {
  it("returns stats for a known game", async () => {
    const stats = await getGameStats(BALDURS_GATE_3_APP_ID);
    expect(stats).not.toBeNull();
    expect(stats?.name).toBe("Baldur's Gate III");
  });

  it("returns null stats for an unknown game", async () => {
    const stats = await getGameStats(999999999);
    expect(stats).toBeNull();
  });

  it("returns review trends ordered by period", async () => {
    const trends = await getGameReviewTrends(BALDURS_GATE_3_APP_ID);
    expect(trends.length).toBeGreaterThan(0);
    const months = trends.map((t) => t.periodMonth);
    expect(months).toEqual([...months].sort());
  });

  it("returns language distribution summing close to 1", async () => {
    const languages = await getGameLanguageDistribution(BALDURS_GATE_3_APP_ID);
    expect(languages.length).toBeGreaterThan(0);
    const total = languages.reduce((sum, l) => sum + l.pctOfTotal, 0);
    expect(total).toBeCloseTo(1, 1);
  });

  it("caps top reviews per voted_up side", async () => {
    const reviews = await getGameTopReviews(BALDURS_GATE_3_APP_ID);
    const positiveCount = reviews.filter((r) => r.votedUp).length;
    const negativeCount = reviews.filter((r) => !r.votedUp).length;
    expect(positiveCount).toBeLessThanOrEqual(TOP_REVIEWS_PER_SIDE);
    expect(negativeCount).toBeLessThanOrEqual(TOP_REVIEWS_PER_SIDE);
  });

  it("honours a smaller per-side cap", async () => {
    const reviews = await getGameTopReviews(BALDURS_GATE_3_APP_ID, 1);
    expect(reviews.filter((r) => r.votedUp).length).toBeLessThanOrEqual(1);
    expect(reviews.filter((r) => !r.votedUp).length).toBeLessThanOrEqual(1);
  });

  it("pages through top games without repeating a game", async () => {
    const firstPage = await getTopGames(5);
    const secondPage = await getTopGames(5, undefined, 5);
    const overlap = secondPage.filter((g) => firstPage.some((f) => f.appId === g.appId));
    expect(overlap).toEqual([]);
  });

  it("returns top games sorted by total reviews descending, excluding games without review data", async () => {
    const games = await getTopGames(10);
    const totals = games.map((g) => g.totalReviews);
    expect(totals).toEqual([...totals].sort((a, b) => b - a));
    expect(totals.every((t) => t > 0)).toBe(true);
  });

  it("filters top games by name when a search query is given", async () => {
    const games = await getTopGames(10, "baldur");
    expect(games.length).toBeGreaterThan(0);
    expect(games.every((g) => g.name.toLowerCase().includes("baldur"))).toBe(true);
  });
});
