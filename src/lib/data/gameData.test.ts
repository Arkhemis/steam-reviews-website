import { describe, expect, it } from "vitest";
import {
  getGameLanguageDistribution,
  getGameReviewTrends,
  getGameReviewLanguages,
  getGameStats,
  getGameTopReviews,
  getReviewDuel,
  getTopGames,
  getTrendingGames,
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
    const reviews = await getGameTopReviews(BALDURS_GATE_3_APP_ID, { perSide: 1 });
    expect(reviews.filter((r) => r.votedUp).length).toBeLessThanOrEqual(1);
    expect(reviews.filter((r) => !r.votedUp).length).toBeLessThanOrEqual(1);
  });

  it("lists the review languages of a game, best represented first", async () => {
    const languages = await getGameReviewLanguages(BALDURS_GATE_3_APP_ID);
    expect(languages.length).toBeGreaterThan(0);
    expect(languages.every((l) => l.reviewCount > 0)).toBe(true);
    const counts = languages.map((l) => l.reviewCount);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it("counts every highlighted review across the languages it lists", async () => {
    const languages = await getGameReviewLanguages(BALDURS_GATE_3_APP_ID);
    const all = await getGameTopReviews(BALDURS_GATE_3_APP_ID, { perSide: 1000 });
    const summed = languages.reduce((sum, l) => sum + l.reviewCount, 0);
    expect(summed).toBe(all.length);
  });

  it("returns only reviews written in the requested language", async () => {
    const [first] = await getGameReviewLanguages(BALDURS_GATE_3_APP_ID);
    const reviews = await getGameTopReviews(BALDURS_GATE_3_APP_ID, { language: first.language });
    expect(reviews.length).toBeGreaterThan(0);
    expect(reviews.every((r) => r.language === first.language)).toBe(true);
  });

  it("returns nothing for a language the game has no reviews in", async () => {
    const reviews = await getGameTopReviews(BALDURS_GATE_3_APP_ID, { language: "__nope__" });
    expect(reviews).toEqual([]);
  });

  it("keeps the per-side cap when filtering by language", async () => {
    const [first] = await getGameReviewLanguages(BALDURS_GATE_3_APP_ID);
    const reviews = await getGameTopReviews(BALDURS_GATE_3_APP_ID, { language: first.language, perSide: 1 });
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

  // Both directions come out of the same 30-day-vs-30-day comparison, so asking
  // for them separately aggregates the whole trend table twice over.
  it("returns both trend directions from a single call", async () => {
    const { up, down } = await getTrendingGames(5);

    expect(up.length).toBeGreaterThan(0);
    expect(down.length).toBeGreaterThan(0);
    expect(up.length).toBeLessThanOrEqual(5);
    expect(down.length).toBeLessThanOrEqual(5);
  });

  it("orders risers by biggest gain and fallers by biggest drop", async () => {
    const { up, down } = await getTrendingGames(5);

    expect(up.map((g) => g.deltaPct)).toEqual([...up.map((g) => g.deltaPct)].sort((a, b) => b - a));
    expect(down.map((g) => g.deltaPct)).toEqual([...down.map((g) => g.deltaPct)].sort((a, b) => a - b));
    expect(up[0].deltaPct).toBeGreaterThanOrEqual(down[0].deltaPct);
  });

  // The duel draws a handful of random games and keeps the first with a ranked
  // review of the right polarity. Drawing only one would leave it empty whenever
  // that game happens to have no such review.
  it("always finds both sides, however the random draw falls", async () => {
    const duels = await Promise.all(Array.from({ length: 10 }, () => getReviewDuel()));
    expect(duels.every((d) => d !== null)).toBe(true);
    expect(duels.every((d) => d!.positive.review.votedUp && !d!.negative.review.votedUp)).toBe(true);
  });

  it("returns one positive and one negative review for the review duel", async () => {
    const duel = await getReviewDuel();
    expect(duel).not.toBeNull();
    expect(duel?.positive.review.votedUp).toBe(true);
    expect(duel?.negative.review.votedUp).toBe(false);
    expect(duel?.positive.game.totalReviews).toBeGreaterThan(5000);
    expect(duel?.negative.game.totalReviews).toBeGreaterThan(5000);
  });
});
