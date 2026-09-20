import { describe, expect, it } from "vitest";
import { pool } from "@/lib/db";
import {
  getAwardReview,
  getCataloguePage,
  getCatalogueTrend,
  getGameEvents,
  getGameLanguageDistribution,
  getGameReviewTrends,
  getGameReviewLanguages,
  getGameStats,
  getGameTopReviews,
  getPolarisedGames,
  getReviewDuel,
  getRecentDeltas,
  getSiteStats,
  getTopGames,
  getTopRatedGamesInWindow,
  getTrendingGames,
  getWindowMovers,
  getWindowRanking,
  getWindowReviewHighlights,
  TOP_REVIEWS_PER_SIDE,
} from "@/lib/data/gameData";
import { hasDuelCoverage, hasMartColumn, hasWindow, hasWindowRanking } from "@/lib/data/martAvailability";

// Les marts du carrousel de la home peuvent manquer à une base plus ancienne
// que le site : leurs cas sont alors sautés, cf. `martAvailability`.
const HAS_WINDOW_SCORE = await hasWindow("week");
const HAS_PREVIOUS_WEEK = await hasWindow("previous_week");
const HAS_PREVIOUS_MONTH = await hasWindow("previous_month");
const HAS_REVIEW_WINDOW_HIGHLIGHT = await hasMartColumn("review_window_highlight", "rank");
const HAS_HIGHLIGHT_CREATED_AT = await hasMartColumn("review_highlight", "created_at");
// Le podium de la home et le duel demandent en plus du volume : une base
// d'échantillon porte les marts sans porter les avis qui les remplissent.
const PODIUM_FLOOR = 100;
const HAS_PODIUM = await hasWindowRanking("month", PODIUM_FLOOR);
const HAS_DUEL_COVERAGE = await hasDuelCoverage();

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

  // La somme du corpus est passée du mart quotidien à son rollup : les deux
  // agrègent les mêmes lignes de `steam_review`, le nombre annoncé ne doit pas
  // bouger d'une unité.
  it("compte le corpus comme le mart quotidien, au rollup près", async () => {
    const stats = await getSiteStats();
    const { rows } = await pool.query<{ total: string }>(
      `SELECT SUM(total_reviews) AS total FROM marts.game_review_trend_daily`,
    );

    expect(stats.storedReviews).toBe(Number(rows[0].total));
  });

  // Le passage par `game_window_score` déplace la définition des deux fenêtres
  // du site vers dbt : une borne décalée d'un jour donnerait une variation
  // plausible mais fausse, que seul un recalcul depuis le mart quotidien
  // rattrape.
  it.skipIf(!HAS_PREVIOUS_MONTH)("date les vignettes comme le ferait le mart quotidien", async () => {
    const { games } = await getCataloguePage({ sort: "most-reviewed", limit: 12, minReviews: 1 });
    const appIds = games.map((g) => g.appId);
    const deltas = await getRecentDeltas(appIds);

    const { rows } = await pool.query<{ app_id: string; delta_pct: string }>(
      `WITH bounds AS (
         SELECT MAX(review_date) AS latest FROM marts.game_review_trend_daily
       ),
       windows AS (
         SELECT
           t.app_id,
           SUM(t.total_reviews) FILTER (WHERE t.review_date > b.latest - INTERVAL '30 days') AS recent_reviews,
           SUM(t.total_positive) FILTER (WHERE t.review_date > b.latest - INTERVAL '30 days') AS recent_positive,
           SUM(t.total_reviews) FILTER (WHERE t.review_date <= b.latest - INTERVAL '30 days') AS previous_reviews,
           SUM(t.total_positive) FILTER (WHERE t.review_date <= b.latest - INTERVAL '30 days') AS previous_positive
         FROM marts.game_review_trend_daily t, bounds b
         WHERE t.app_id = ANY($1::bigint[])
           AND t.review_date > b.latest - INTERVAL '60 days'
         GROUP BY t.app_id
       )
       SELECT
         app_id,
         ROUND(
           (recent_positive::numeric / recent_reviews
             - previous_positive::numeric / previous_reviews) * 100,
           1
         ) AS delta_pct
       FROM windows
       WHERE recent_reviews >= 30 AND previous_reviews >= 30`,
      [appIds],
    );

    expect(rows.length).toBeGreaterThan(0);
    expect(deltas.size).toBe(rows.length);
    for (const row of rows) {
      // `pct_positive` est arrondi à quatre décimales dans le mart : la
      // différence des deux parts peut s'écarter d'un centième de point de
      // celle calculée sur les sommes brutes.
      expect(deltas.get(Number(row.app_id))).toBeCloseTo(Number(row.delta_pct), 1);
    }
  });

  // Même déplacement que pour la somme du corpus : le rollup agrège les mêmes
  // lignes que le mart par (jeu, jour), jour par jour. La courbe ne doit pas
  // bouger d'un point.
  it("trace la même courbe que le mart quotidien, au rollup près", async () => {
    const trend = await getCatalogueTrend();
    const { rows } = await pool.query<{ review_date: string; reviews: string; positive: string }>(
      `WITH bounds AS (
         SELECT MAX(review_date) AS latest FROM marts.game_review_trend_daily
       )
       SELECT
         TO_CHAR(t.review_date, 'YYYY-MM-DD') AS review_date,
         SUM(t.total_reviews) AS reviews,
         SUM(t.total_positive) AS positive
       FROM marts.game_review_trend_daily t, bounds b
       WHERE t.review_date >= (DATE_TRUNC('month', b.latest) - INTERVAL '11 months')::date
         AND t.review_date <= b.latest
       GROUP BY t.review_date
       ORDER BY t.review_date`,
    );

    expect(rows.length).toBeGreaterThan(0);
    expect(trend).toEqual(
      rows.map((row) => ({
        date: row.review_date,
        reviews: Number(row.reviews),
        positive: Number(row.positive),
      })),
    );
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
  it.skipIf(!HAS_DUEL_COVERAGE)("always finds both sides, however the random draw falls", async () => {
    const duels = await Promise.all(Array.from({ length: 10 }, () => getReviewDuel()));
    expect(duels.every((d) => d !== null)).toBe(true);
    expect(duels.every((d) => d!.positive.review.votedUp && !d!.negative.review.votedUp)).toBe(true);
  });

  it.skipIf(!HAS_DUEL_COVERAGE)("returns one positive and one negative review for the review duel", async () => {
    const duel = await getReviewDuel();
    expect(duel).not.toBeNull();
    expect(duel?.positive.review.votedUp).toBe(true);
    expect(duel?.negative.review.votedUp).toBe(false);
    expect(duel?.positive.game.totalReviews).toBeGreaterThan(5000);
    expect(duel?.negative.game.totalReviews).toBeGreaterThan(5000);
  });

  // --- Home éditoriale ---

  it.skipIf(!HAS_PODIUM)("classe le podium d'une fenêtre par part d'avis positifs décroissante", async () => {
    const { games } = await getTopRatedGamesInWindow("month", 5, PODIUM_FLOOR);

    expect(games.length).toBeGreaterThan(0);
    expect(games.map((g) => g.pctPositive)).toEqual(
      [...games.map((g) => g.pctPositive)].sort((a, b) => b - a),
    );
    expect(games.every((g) => g.pctPositive >= 0 && g.pctPositive <= 1)).toBe(true);
  });

  it.skipIf(!HAS_WINDOW_SCORE)("écarte du podium les jeux qui n'atteignent pas le seuil de la fenêtre", async () => {
    const floor = 500;
    const { games } = await getTopRatedGamesInWindow("month", 5, floor);

    expect(games.every((g) => g.reviews >= floor)).toBe(true);
  });

  // La home montre le gagnant en grand : un jeu sans jaquette y laisserait un
  // cadre vide, héros compris.
  it.skipIf(!HAS_PODIUM)("ne sacre que des jeux qui ont une jaquette", async () => {
    const { games } = await getTopRatedGamesInWindow("month", 5, PODIUM_FLOOR);

    expect(games.length).toBeGreaterThan(0);
    expect(games.every((g) => g.coverUrl !== null)).toBe(true);
  });

  it.skipIf(!HAS_PODIUM)("rend la fenêtre du podium, ancrée sur la dernière date du mart", async () => {
    const window = await getTopRatedGamesInWindow("month", 1, PODIUM_FLOOR);

    expect(window.startsOn).not.toBeNull();
    expect(window.endsOn).not.toBeNull();
    expect(window.startsOn! < window.endsOn!).toBe(true);
  });

  it.skipIf(!HAS_WINDOW_SCORE)("resserre la fenêtre quand on demande la semaine plutôt que le mois", async () => {
    const [week, month] = await Promise.all([
      getTopRatedGamesInWindow("week", 1, 10),
      getTopRatedGamesInWindow("month", 1, 10),
    ]);

    expect(week.endsOn).toBe(month.endsOn);
    expect(week.startsOn! > month.startsOn!).toBe(true);
  });

  it.skipIf(!HAS_WINDOW_SCORE)("lit l'année en cours sous le nom que lui donne le mart", async () => {
    const year = await getTopRatedGamesInWindow("year-to-date", 1, 10);

    expect(year.games.length).toBeGreaterThan(0);
    expect(year.startsOn!.slice(5)).toBe("01-01");
  });

  it.skipIf(!HAS_WINDOW_SCORE)("range les plus détestés de la fenêtre du pire au moins pire", async () => {
    const { games } = await getWindowRanking("month", "worst", { limit: 5, minReviews: 10 });

    expect(games.length).toBeGreaterThan(0);
    expect(games.map((g) => g.pctPositive)).toEqual([...games.map((g) => g.pctPositive)].sort((a, b) => a - b));
  });

  it.skipIf(!HAS_WINDOW_SCORE)("range les plus commentés de la semaine par volume décroissant", async () => {
    const { games } = await getWindowRanking("week", "most-reviewed", { limit: 5, minReviews: 1 });

    expect(games.length).toBeGreaterThan(0);
    expect(games.map((g) => g.reviews)).toEqual([...games.map((g) => g.reviews)].sort((a, b) => b - a));
  });

  it.skipIf(!HAS_WINDOW_SCORE)("plafonne le total Steam des pépites cachées", async () => {
    const cap = 2000;
    const { games } = await getWindowRanking("month", "best", { limit: 5, minReviews: 10, maxTotalReviews: cap });

    expect(games.every((g) => g.totalReviews < cap)).toBe(true);
  });

  it.skipIf(!HAS_PREVIOUS_WEEK)("ne rend que des écarts du bon signe entre les deux semaines", async () => {
    const { up, down } = await getWindowMovers(10);

    if (up) expect(up.deltaPts).toBeGreaterThan(0);
    if (down) expect(down.deltaPts).toBeLessThan(0);
    for (const mover of [up, down]) {
      if (!mover) continue;
      expect(mover.reviews).toBeGreaterThanOrEqual(10);
      expect(mover.deltaPts).toBeCloseTo((mover.pctPositive - mover.previousPctPositive) * 100, 1);
    }
  });

  it.skipIf(!HAS_REVIEW_WINDOW_HIGHLIGHT)("rend les reviews primées rang par rang, un jeu au plus par classement", async () => {
    const highlights = await getWindowReviewHighlights("month");

    for (const ranking of [highlights.funny, highlights.helpful]) {
      expect(ranking.length).toBeLessThanOrEqual(5);
      expect(ranking.map((r) => r.rank)).toEqual([...ranking.map((r) => r.rank)].sort((a, b) => a - b));
      expect(new Set(ranking.map((r) => r.appId)).size).toBe(ranking.length);
    }
  });

  it.skipIf(!HAS_HIGHLIGHT_CREATED_AT)("trouve une review positive anglaise écrite dans la fenêtre", async () => {
    const review = await getAwardReview(BALDURS_GATE_3_APP_ID, { startsOn: "2000-01-01", endsOn: "2100-12-31" });

    expect(review).not.toBeNull();
    expect(review?.votedUp).toBe(true);
    expect(review?.language).toBe("english");
  });

  it.skipIf(!HAS_HIGHLIGHT_CREATED_AT)("ne rend rien pour une fenêtre où le jeu n'a pas de review retenue", async () => {
    expect(
      await getAwardReview(BALDURS_GATE_3_APP_ID, { startsOn: "1990-01-01", endsOn: "1990-01-07" }),
    ).toBeNull();
  });

  // Sans fenêtre, la requête ne touche pas `created_at` : c'est ce repli qui
  // tient quand le mart n'a pas encore remonté la colonne.
  it("trouve la meilleure review négative de toujours", async () => {
    const review = await getAwardReview(BALDURS_GATE_3_APP_ID, { sentiment: "negative" });

    expect(review).not.toBeNull();
    expect(review?.votedUp).toBe(false);
  });

  it("prend la review des deux camps quand le verdict est indifférent", async () => {
    const [any, positive] = await Promise.all([
      getAwardReview(BALDURS_GATE_3_APP_ID, { sentiment: "any" }),
      getAwardReview(BALDURS_GATE_3_APP_ID, { sentiment: "positive" }),
    ]);

    expect(any).not.toBeNull();
    // Le meilleur des deux camps réunis est au moins aussi bien classé que le
    // meilleur du seul camp positif.
    expect(any!.rankInGame).toBeLessThanOrEqual(positive!.rankInGame);
  });

  it("rend la review la plus utile quand on la demande par les votes", async () => {
    const [helpful, others] = await Promise.all([
      getAwardReview(BALDURS_GATE_3_APP_ID, { sentiment: "any", order: "helpful" }),
      getGameTopReviews(BALDURS_GATE_3_APP_ID, { language: "english", perSide: 5 }),
    ]);

    expect(helpful).not.toBeNull();
    expect(helpful?.votesUp).toBeGreaterThanOrEqual(Math.max(...others.map((review) => review.votesUp)));
  });

  it("ne rend rien pour un jeu sans review retenue", async () => {
    expect(await getAwardReview(-1, {})).toBeNull();
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
