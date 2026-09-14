import { describe, expect, it } from "vitest";
import {
  getCatalogueTrend,
  getGameEvents,
  getGameLanguageDistribution,
  getGameReviewTrends,
  getGameReviewLanguages,
  getGameStats,
  getGameTopReviews,
  getPolarisedGames,
  getReviewDuel,
  getSiteStats,
  getTopGames,
  getTopRatedGamesInWindow,
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

  it("compte les avis réellement chargés, pas ceux que Steam déclare", async () => {
    const stats = await getSiteStats();

    // `SUM()` sur des entiers revient en `numeric`, donc en chaîne côté pg :
    // l'entier garantit que la conversion est bien faite avant le rendu.
    expect(Number.isInteger(stats.storedReviews)).toBe(true);
    expect(stats.storedReviews).toBeGreaterThan(0);
    expect(Number.isInteger(stats.totalGames)).toBe(true);
    expect(stats.totalGames).toBeGreaterThan(0);
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

  it("returns news and update events ordered by date", async () => {
    const events = await getGameEvents(BALDURS_GATE_3_APP_ID);
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.category === "news" || e.category === "update")).toBe(true);
    expect(events.map((e) => e.startedOn)).toEqual([...events.map((e) => e.startedOn)].sort());
    expect(events.every((e) => e.pctNegative >= 0 && e.pctNegative <= 1)).toBe(true);

    // Le mart ne juge une annonce mal reçue qu'au-delà de 25 % de votes
    // négatifs, et seulement si elle réunit assez de votes pour que le ratio
    // veuille dire quelque chose. Cf. marts/game_event_highlight.sql.
    expect(
      events.every((e) => {
        const controversee = e.pctNegative > 0.25 && e.votesUp + e.votesDown >= 100;
        return e.isWellReceived === !controversee;
      }),
    ).toBe(true);
  });

  it("returns no event for an unknown game", async () => {
    expect(await getGameEvents(999999999)).toEqual([]);
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

  // --- Home éditoriale ---

  it("classe le podium d'une fenêtre par part d'avis positifs décroissante", async () => {
    const { games } = await getTopRatedGamesInWindow("month", 5, 100);

    expect(games.length).toBeGreaterThan(0);
    expect(games.map((g) => g.pctPositive)).toEqual(
      [...games.map((g) => g.pctPositive)].sort((a, b) => b - a),
    );
    expect(games.every((g) => g.pctPositive >= 0 && g.pctPositive <= 1)).toBe(true);
  });

  it("écarte du podium les jeux qui n'atteignent pas le seuil de la fenêtre", async () => {
    const floor = 500;
    const { games } = await getTopRatedGamesInWindow("month", 5, floor);

    expect(games.every((g) => g.reviews >= floor)).toBe(true);
  });

  // La home montre le gagnant en grand : un jeu sans jaquette y laisserait un
  // cadre vide, héros compris.
  it("ne sacre que des jeux qui ont une jaquette", async () => {
    const { games } = await getTopRatedGamesInWindow("month", 5, 100);

    expect(games.length).toBeGreaterThan(0);
    expect(games.every((g) => g.coverUrl !== null)).toBe(true);
  });

  it("rend la fenêtre du podium, ancrée sur la dernière date du mart", async () => {
    const window = await getTopRatedGamesInWindow("month", 1, 100);

    expect(window.startsOn).not.toBeNull();
    expect(window.endsOn).not.toBeNull();
    expect(window.startsOn! < window.endsOn!).toBe(true);
  });

  it("resserre la fenêtre quand on demande la semaine plutôt que le mois", async () => {
    const [week, month] = await Promise.all([
      getTopRatedGamesInWindow("week", 1, 10),
      getTopRatedGamesInWindow("month", 1, 10),
    ]);

    expect(week.endsOn).toBe(month.endsOn);
    expect(week.startsOn! > month.startsOn!).toBe(true);
  });

  it("range les jeux clivants du plus proche de 50 % au moins proche", async () => {
    const games = await getPolarisedGames(5, 1000);

    expect(games.length).toBeGreaterThan(0);
    const distances = games.map((g) => Math.abs(g.pctPositive * 100 - 50));
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
    expect(games.every((g) => g.totalReviews >= 1000)).toBe(true);
    expect(games.every((g) => g.coverUrl !== null)).toBe(true);
  });

  it("rend le pouls du catalogue jour par jour, sans trou d'ordre", async () => {
    const days = await getCatalogueTrend();

    expect(days.length).toBeGreaterThan(0);
    expect(days.map((d) => d.date)).toEqual([...days.map((d) => d.date)].sort());
    expect(days.every((d) => d.positive <= d.reviews)).toBe(true);

    // Douze mois calendaires au plus : le premier jour rendu ne peut pas être
    // antérieur au premier du mois, onze mois avant le dernier jour rendu.
    const last = new Date(`${days[days.length - 1].date}T00:00:00Z`);
    const floor = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() - 11, 1));
    expect(new Date(`${days[0].date}T00:00:00Z`) >= floor).toBe(true);
  });
});
