import { pool } from "@/lib/db";
import type {
  CatalogueGame,
  CataloguePage,
  CatalogueSort,
  CatalogueTrendDay,
  GameCoverage,
  GameEvent,
  GameLanguageDistribution,
  GameReviewLanguage,
  GameReviewTrend,
  GameStats,
  GameTopReview,
  LanguageReviewScore,
  RankedWindow,
  ReviewDuel,
  ReviewWindow,
  SiteStats,
  TrendingGame,
  TrendingGames,
  WindowMover,
  WindowMovers,
  WindowRankingSort,
  WindowReviewHighlight,
  WindowReviewHighlights,
} from "@/lib/data/types";

const GAME_STATS_COLUMNS = `
  steam_app_id,
  game_name,
  genres,
  developers,
  publishers,
  cover_url,
  first_release_date,
  total_reviews,
  pct_positive_reviews,
  review_score,
  median_playtime_forever_minutes,
  pct_primarily_steam_deck,
  pct_refunded
`;

type GameStatsRow = {
  steam_app_id: string;
  game_name: string;
  genres: string[] | null;
  developers: string[] | null;
  publishers: string[] | null;
  cover_url: string | null;
  first_release_date: Date | null;
  total_reviews: string;
  pct_positive_reviews: string;
  review_score: number;
  median_playtime_forever_minutes: string;
  pct_primarily_steam_deck: string;
  pct_refunded: string;
};

const REVIEW_HIGHLIGHT_COLUMNS = `
  rh.recommendation_id, rh.app_id, rh.review_text, rh.language, rh.voted_up,
  rh.votes_up, rh.votes_funny, rh.weighted_vote_score, rh.author_personaname,
  rh.author_avatar, rh.author_profile_url, rh.author_playtime_at_review_minutes,
  rh.author_last_played_at, rh.rank_in_game
`;

type TopReviewRow = {
  recommendation_id: string;
  app_id: string;
  review_text: string;
  language: string;
  voted_up: boolean;
  votes_up: number;
  votes_funny: number;
  weighted_vote_score: string;
  author_personaname: string;
  author_avatar: string;
  author_profile_url: string;
  author_playtime_at_review_minutes: number;
  author_last_played_at: Date | null;
  rank_in_game: string;
};

function mapTopReviewRow(row: TopReviewRow): GameTopReview {
  return {
    recommendationId: Number(row.recommendation_id),
    appId: Number(row.app_id),
    reviewText: row.review_text,
    language: row.language,
    votedUp: row.voted_up,
    votesUp: row.votes_up,
    votesFunny: row.votes_funny,
    weightedVoteScore: Number(row.weighted_vote_score),
    authorPersonaname: row.author_personaname,
    authorAvatarUrl: `https://avatars.steamstatic.com/${row.author_avatar}_full.jpg`,
    authorPlaytimeAtReviewMinutes: row.author_playtime_at_review_minutes,
    authorLastPlayedAt: row.author_last_played_at
      ? (row.author_last_played_at as Date).toISOString()
      : null,
    reviewUrl: `${row.author_profile_url}recommended/${row.app_id}`,
    rankInGame: Number(row.rank_in_game),
  };
}

function mapGameStatsRow(row: GameStatsRow): GameStats {
  return {
    appId: Number(row.steam_app_id),
    name: row.game_name,
    genres: row.genres ?? [],
    developers: row.developers ?? [],
    publishers: row.publishers ?? [],
    coverUrl: row.cover_url,
    firstReleaseDate: row.first_release_date
      ? (row.first_release_date as Date).toISOString().slice(0, 10)
      : null,
    totalReviews: Number(row.total_reviews),
    reviewScore: row.review_score,
    pctPositive: Number(row.pct_positive_reviews) / 100,
    playtimeMedianMinutes: Number(row.median_playtime_forever_minutes),
    pctSteamDeck: Number(row.pct_primarily_steam_deck) / 100,
    pctRefunded: Number(row.pct_refunded) / 100,
  };
}

export async function getGameStats(appId: number): Promise<GameStats | null> {
  const { rows } = await pool.query(
    `SELECT ${GAME_STATS_COLUMNS} FROM marts.game_stats WHERE steam_app_id = $1`,
    [appId],
  );

  const row = rows[0];
  return row ? mapGameStatsRow(row) : null;
}

export async function getTopGames(limit: number, search?: string, offset = 0): Promise<GameStats[]> {
  const query = search?.trim();
  const { rows } = await pool.query(
    `SELECT ${GAME_STATS_COLUMNS} FROM marts.game_stats
     WHERE total_reviews > 0 AND ($2::text IS NULL OR game_name ILIKE '%' || $2 || '%')
     ORDER BY total_reviews DESC, steam_app_id
     LIMIT $1 OFFSET $3`,
    [limit, query || null, offset],
  );

  return rows.map(mapGameStatsRow);
}

// `minReviews` filters out low-volume games so a handful of reviews can't land
// a game at the very top (or bottom) of the ranking by chance.
export async function getRankedGames(
  direction: "best" | "worst",
  limit: number,
  minReviews = 500,
): Promise<GameStats[]> {
  const { rows } = await pool.query(
    `SELECT ${GAME_STATS_COLUMNS} FROM marts.game_stats
     WHERE total_reviews >= $2
     ORDER BY pct_positive_reviews ${direction === "best" ? "DESC" : "ASC"}, total_reviews DESC
     LIMIT $1`,
    [limit, minReviews],
  );

  return rows.map(mapGameStatsRow);
}

/**
 * Les deux nombres que la home annonce en ouverture. Ils ne sortent pas du
 * même mart, parce qu'ils ne comptent pas la même chose :
 *
 * - `game_stats.total_reviews` est ce que Steam *déclare* pour chaque jeu,
 *   avis jamais téléchargés compris. Bon pour situer un jeu, faux pour
 *   annoncer la taille du corpus.
 * - `catalogue_review_trend_daily` agrège les lignes de `steam_review` : sa
 *   somme est le nombre d'avis réellement en base, au jour près.
 *
 * D'où la somme sur le mart quotidien, déjà agrégé, plutôt qu'un `COUNT(*)`
 * sur la table d'avis elle-même. C'est bien le rollup du catalogue qu'on lit,
 * pas `game_review_trend_daily` : les deux totalisent les mêmes avis, mais le
 * premier en fait une ligne par jour quand le second en fait une par
 * (jeu, jour) — cinq mille lignes contre vingt millions, pour le même nombre.
 */
export function siteStatsQuery(): { text: string; values: unknown[] } {
  return {
    text: `SELECT
       (SELECT SUM(total_reviews) FROM marts.catalogue_review_trend_daily) AS stored_reviews,
       COUNT(*) AS total_games
     FROM marts.game_stats WHERE total_reviews > 0`,
    values: [],
  };
}

export async function getSiteStats(): Promise<SiteStats> {
  const query = siteStatsQuery();
  const { rows } = await pool.query(query.text, query.values);

  return {
    storedReviews: Number(rows[0]?.stored_reviews ?? 0),
    totalGames: Number(rows[0]?.total_games ?? 0),
  };
}

type TrendingGameRow = {
  app_id: string;
  game_name: string;
  cover_url: string | null;
  recent_reviews: string;
  recent_pct: string;
  previous_pct: string;
  delta_pct: string;
};

// La bascule d'un mois sur l'autre — les trente derniers jours contre les
// trente qui précèdent — est pré-agrégée par `game_window_score`, qui porte une
// ligne par (fenêtre, jeu) : `month` et `previous_month`. Posée au mart
// quotidien, la même question réagrégeait un demi-million de lignes de
// (jeu, jour) à chaque expiration de cache.
//
// Le plancher de volume est exigé des deux côtés de la bascule pour qu'une
// poignée d'avis ne fasse pas un écart de vingt points. Les deux extrémités du
// classement reviennent ensemble : le join est le même des deux côtés.
//
// Les bornes des fenêtres sont celles du mart, ancrées sur sa dernière
// `review_date` et non sur `CURRENT_DATE` — le pipeline peut avoir des jours de
// retard, et un ancrage sur « aujourd'hui » renverrait un classement vide dès
// qu'il en a.
const MONTH_DELTAS_CTE = `
  WITH deltas AS (
    SELECT
      m.app_id,
      g.game_name,
      g.cover_url,
      g.total_reviews,
      m.total_reviews AS recent_reviews,
      ROUND(m.pct_positive * 100, 1) AS recent_pct,
      ROUND(p.pct_positive * 100, 1) AS previous_pct,
      ROUND((m.pct_positive - p.pct_positive) * 100, 1) AS delta_pct
    FROM marts.game_window_score m
    JOIN marts.game_window_score p ON p.app_id = m.app_id AND p.window_name = 'previous_month'
    JOIN marts.game_stats g ON g.steam_app_id = m.app_id
    WHERE m.window_name = 'month'
      AND m.total_reviews >= $2 AND p.total_reviews >= $2
  )
`;

export function trendingGamesQuery(
  limit: number,
  minReviewsPerWindow: number,
): { text: string; values: unknown[] } {
  return {
    text: `${MONTH_DELTAS_CTE}
     (SELECT *, 'up' AS direction FROM deltas ORDER BY delta_pct DESC LIMIT $1)
     UNION ALL
     (SELECT *, 'down' AS direction FROM deltas ORDER BY delta_pct ASC LIMIT $1)`,
    values: [limit, minReviewsPerWindow],
  };
}

export async function getTrendingGames(
  limit: number,
  minReviewsPerWindow = 30,
): Promise<TrendingGames> {
  const query = trendingGamesQuery(limit, minReviewsPerWindow);
  const { rows } = await pool.query<TrendingGameRow & { direction: "up" | "down" }>(
    query.text,
    query.values,
  );

  const toTrendingGame = (row: TrendingGameRow): TrendingGame => ({
    appId: Number(row.app_id),
    name: row.game_name,
    coverUrl: row.cover_url,
    recentReviews: Number(row.recent_reviews),
    recentPctPositive: Number(row.recent_pct) / 100,
    previousPctPositive: Number(row.previous_pct) / 100,
    deltaPct: Number(row.delta_pct),
  });

  return {
    up: rows.filter((r) => r.direction === "up").map(toTrendingGame),
    down: rows.filter((r) => r.direction === "down").map(toTrendingGame),
  };
}

// Picks a random top-voted positive review from a well-reviewed game, so the home
// page shows one genuine review instead of static placeholder text.
export async function getFeaturedReview(): Promise<{ game: GameStats; review: GameTopReview } | null> {
  const { rows } = await pool.query(
    `SELECT
       ${REVIEW_HIGHLIGHT_COLUMNS},
       g.steam_app_id, g.game_name, g.genres, g.developers, g.publishers, g.cover_url,
       g.first_release_date, g.total_reviews, g.pct_positive_reviews, g.review_score,
       g.median_playtime_forever_minutes, g.pct_primarily_steam_deck, g.pct_refunded
     FROM marts.review_highlight rh
     JOIN marts.game_stats g ON g.steam_app_id = rh.app_id
     WHERE rh.rank_in_game = 1 AND rh.voted_up = true AND g.total_reviews > 5000
     ORDER BY RANDOM()
     LIMIT 1`,
  );

  const row = rows[0];
  if (!row) return null;

  return { game: mapGameStatsRow(row), review: mapTopReviewRow(row) };
}

// Picks one random top-voted positive and one random top-voted negative review (each from a
// well-reviewed game, not necessarily the same one) so the home page can show a "two sides"
// contrast without either side being cherry-picked.
const GAME_STATS_JOIN_COLUMNS = `
  g.steam_app_id, g.game_name, g.genres, g.developers, g.publishers, g.cover_url,
  g.first_release_date, g.total_reviews, g.pct_positive_reviews, g.review_score,
  g.median_playtime_forever_minutes, g.pct_primarily_steam_deck, g.pct_refunded
`;

// Drawing the review straight out of `review_highlight` with ORDER BY RANDOM()
// forces Postgres to materialise and sort every candidate row — `review_text`
// included — just to hand back one. In production that is a ~4.4 GB sequential
// scan per side, 54s for the pair, and it gates the whole home page.
//
// So we draw the *game* at random instead (a few thousand narrow rows in
// `game_stats`, already indexed on total_reviews), then fetch that game's ranked
// review through the `app_id` index. A handful of candidates rather than one
// covers the rare game that has no ranked review of the requested polarity.
const DUEL_CANDIDATE_GAMES = 20;

function reviewDuelSide(side: "positive" | "negative"): string {
  return `(SELECT
      ${REVIEW_HIGHLIGHT_COLUMNS},
      ${GAME_STATS_JOIN_COLUMNS},
      '${side}' AS side
    FROM (
      SELECT steam_app_id
      FROM marts.game_stats
      WHERE total_reviews > $1
      ORDER BY RANDOM()
      LIMIT $2
    ) c
    JOIN LATERAL (
      SELECT *
      FROM marts.review_highlight r
      WHERE r.app_id = c.steam_app_id
        AND r.rank_in_game = 1
        AND r.voted_up = ${side === "positive"}
      LIMIT 1
    ) rh ON true
    JOIN marts.game_stats g ON g.steam_app_id = c.steam_app_id
    LIMIT 1)`;
}

export function reviewDuelQuery(minReviews = 5000): { text: string; values: unknown[] } {
  return {
    text: `${reviewDuelSide("positive")}
     UNION ALL
     ${reviewDuelSide("negative")}`,
    values: [minReviews, DUEL_CANDIDATE_GAMES],
  };
}

export async function getReviewDuel(minReviews = 5000): Promise<ReviewDuel | null> {
  const query = reviewDuelQuery(minReviews);
  const { rows } = await pool.query<TopReviewRow & GameStatsRow & { side: "positive" | "negative" }>(
    query.text,
    query.values,
  );

  const positiveRow = rows.find((r) => r.side === "positive");
  const negativeRow = rows.find((r) => r.side === "negative");
  if (!positiveRow || !negativeRow) return null;

  return {
    positive: { game: mapGameStatsRow(positiveRow), review: mapTopReviewRow(positiveRow) },
    negative: { game: mapGameStatsRow(negativeRow), review: mapTopReviewRow(negativeRow) },
  };
}

type GameReviewTrendRow = {
  period_month: string;
  reviews_in_period: string;
  positive_in_period: string;
  pct_positive_period: string;
};

export async function getGameReviewTrends(appId: number): Promise<GameReviewTrend[]> {
  const { rows } = await pool.query<GameReviewTrendRow>(
    `SELECT
       TO_CHAR(DATE_TRUNC('month', review_date), 'YYYY-MM-DD') AS period_month,
       SUM(total_reviews) AS reviews_in_period,
       SUM(total_positive) AS positive_in_period,
       ROUND(SUM(total_positive)::numeric / NULLIF(SUM(total_reviews), 0), 4) AS pct_positive_period
     FROM marts.game_review_trend_daily
     WHERE app_id = $1
     GROUP BY 1
     ORDER BY 1`,
    [appId],
  );

  return rows.map((row) => ({
    appId,
    periodMonth: row.period_month,
    reviewsInPeriod: Number(row.reviews_in_period),
    positiveInPeriod: Number(row.positive_in_period),
    pctPositivePeriod: Number(row.pct_positive_period),
  }));
}

/**
 * Le pouls d'un jeu : ses `days` derniers jours d'avis, ancrés sur la dernière
 * date que le mart connaît pour lui — jamais sur `CURRENT_DATE`, que le
 * pipeline peut avoir des jours de retard à rejoindre, et jamais sur la
 * dernière date du catalogue, qu'un jeu mort depuis des mois n'atteint pas.
 *
 * Les jours sans avis n'ont pas de ligne dans le mart : c'est `paddedDailyVolume`
 * qui rebouche les trous, ici on ne lit que ce qui existe.
 */
export async function getGameDailyTrend(appId: number, days = 31): Promise<CatalogueTrendDay[]> {
  const { rows } = await pool.query<{ review_date: string; reviews: string; positive: string }>(
    `WITH bounds AS (
       SELECT MAX(review_date) AS latest FROM marts.game_review_trend_daily WHERE app_id = $1
     )
     SELECT
       TO_CHAR(t.review_date, 'YYYY-MM-DD') AS review_date,
       t.total_reviews AS reviews,
       t.total_positive AS positive
     FROM marts.game_review_trend_daily t, bounds b
     WHERE t.app_id = $1 AND t.review_date > b.latest - $2::int
     ORDER BY t.review_date`,
    [appId, days],
  );

  return rows.map((row) => ({
    date: row.review_date,
    reviews: Number(row.reviews),
    positive: Number(row.positive),
  }));
}

/**
 * L'assiette de l'analyse pour un jeu : ce qu'on a vraiment chargé de lui, par
 * opposition au `total_reviews` de `game_stats`, qui est ce que Steam déclare,
 * avis jamais téléchargés compris.
 *
 * Les trois lectures partent ensemble : ce sont trois agrégats indexés par
 * `app_id` et le bandeau les affiche d'un bloc, il n'y a rien à gagner à les
 * séparer en trois allers-retours.
 */
export async function getGameCoverage(appId: number): Promise<GameCoverage> {
  const { rows } = await pool.query<{
    loaded_reviews: string | null;
    latest_review_on: string | null;
    language_count: string;
  }>(
    `WITH daily AS (
       SELECT SUM(total_reviews) AS loaded_reviews, MAX(review_date) AS latest_review_on
       FROM marts.game_review_trend_daily
       WHERE app_id = $1
     )
     SELECT
       d.loaded_reviews,
       TO_CHAR(d.latest_review_on, 'YYYY-MM-DD') AS latest_review_on,
       (SELECT COUNT(*) FROM intermediate.language_review_score WHERE app_id = $1) AS language_count
     FROM daily d`,
    [appId],
  );

  const row = rows[0];
  return {
    loadedReviews: Number(row?.loaded_reviews ?? 0),
    languageCount: Number(row?.language_count ?? 0),
    latestReviewOn: row?.latest_review_on ?? null,
  };
}

type GameEventRow = {
  gid: string;
  started_on: string;
  event_category: "news" | "update";
  headline: string;
  votes_up: number;
  votes_down: number;
  comment_count: number;
  image_url: string | null;
  pct_negative: string;
  is_well_received: boolean;
};

// Le tri et la sélection (`news`/`update` seulement, les 3 annonces les plus
// discutées de chaque année plus jusqu'à 2 controverses repêchées) sont faits en
// amont dans le mart : lire `intermediate.steam_event_categorized` directement
// coûtait un Parallel Seq Scan de 8 s sur 1,77 M de lignes, contre 0,1 ms ici
// grâce à l'index (app_id, started_on).
export async function getGameEvents(appId: number): Promise<GameEvent[]> {
  const { rows } = await pool.query<GameEventRow>(
    `SELECT
       gid,
       TO_CHAR(started_on, 'YYYY-MM-DD') AS started_on,
       event_category,
       headline,
       votes_up,
       votes_down,
       comment_count,
       image_url,
       pct_negative,
       is_well_received
     FROM marts.game_event_highlight
     WHERE app_id = $1
     ORDER BY started_on`,
    [appId],
  );

  return rows.map((row) => ({
    appId,
    gid: row.gid,
    startedOn: row.started_on,
    category: row.event_category,
    headline: row.headline,
    votesUp: Number(row.votes_up),
    votesDown: Number(row.votes_down),
    commentCount: Number(row.comment_count),
    imageUrl: row.image_url,
    pctNegative: Number(row.pct_negative),
    isWellReceived: row.is_well_received,
  }));
}

type GameLanguageDistributionRow = {
  app_id: string;
  language: string;
  review_count: string;
  pct_of_total: string;
};

// `marts.game_language_distribution` n'existe plus : le modèle a été remplacé
// en amont par `language_review_score` (même grain app_id + langue, plus les
// votes positifs). La table ne subsiste en prod que comme résidu d'un ancien
// run — figée depuis, et effacée au prochain full refresh. On lit donc la
// source vivante, dont `total_reviews` porte l'ancien `review_count`.
export async function getGameLanguageDistribution(appId: number): Promise<GameLanguageDistribution[]> {
  const { rows } = await pool.query<GameLanguageDistributionRow>(
    `SELECT app_id, language, total_reviews AS review_count, pct_of_total
     FROM intermediate.language_review_score
     WHERE app_id = $1
     ORDER BY pct_of_total DESC`,
    [appId],
  );

  return rows.map((row) => ({
    appId: Number(row.app_id),
    language: row.language,
    reviewCount: Number(row.review_count),
    pctOfTotal: Number(row.pct_of_total),
  }));
}

type LanguageReviewScoreRow = {
  language: string;
  total_reviews: string;
  total_positive: string;
  pct_positive: string;
  pct_of_total: string;
};

function mapLanguageReviewScoreRow(row: LanguageReviewScoreRow): LanguageReviewScore {
  return {
    language: row.language,
    totalReviews: Number(row.total_reviews),
    totalPositive: Number(row.total_positive),
    pctPositive: Number(row.pct_positive),
    pctOfTotal: Number(row.pct_of_total),
  };
}

const LANGUAGE_REVIEW_SCORE_COLUMNS = "language, total_reviews, total_positive, pct_positive, pct_of_total";

export async function getLanguageReviewScores(): Promise<LanguageReviewScore[]> {
  const { rows } = await pool.query<LanguageReviewScoreRow>(
    `SELECT ${LANGUAGE_REVIEW_SCORE_COLUMNS}
     FROM marts.language_review_score_global
     ORDER BY pct_of_total DESC`,
  );

  return rows.map(mapLanguageReviewScoreRow);
}

// Same shape as the global scores above, but for a single game. Upstream only
// exposes this grain in the intermediate layer for now
// (`language_review_score`, one row per app_id + language); the marts layer
// only rolls it up globally. TODO: point this at a mart once one exists.
export async function getGameLanguageReviewScores(appId: number): Promise<LanguageReviewScore[]> {
  const { rows } = await pool.query<LanguageReviewScoreRow>(
    `SELECT ${LANGUAGE_REVIEW_SCORE_COLUMNS}
     FROM intermediate.language_review_score
     WHERE app_id = $1
     ORDER BY pct_of_total DESC`,
    [appId],
  );

  return rows.map(mapLanguageReviewScoreRow);
}

// Upstream ranks `review_highlight` per (app_id, voted_up, language) and keeps
// 30 of each, so a game commented in twenty-odd languages carries well over a
// thousand rows — full review texts included. Nothing on the site shows more
// than a couple at a time, so the cap belongs in the query rather than in the
// RSC payload. Ordering by `rank_in_game` before the tie-break keeps the
// language spread: every language's best review outranks any language's second
// best, so a small `perSide` still yields a varied pool instead of twenty
// English reviews.
export const TOP_REVIEWS_PER_SIDE = 20;

// Alimente le sélecteur de langue de la fiche : un GROUP BY sur l'index
// `app_id`, sans toucher à `review_text`, donc bien moins cher que de déduire
// les langues disponibles des reviews elles-mêmes.
export async function getGameReviewLanguages(appId: number): Promise<GameReviewLanguage[]> {
  const { rows } = await pool.query<{ language: string; review_count: string }>(
    `SELECT language, COUNT(*) AS review_count
     FROM marts.review_highlight
     WHERE app_id = $1
     GROUP BY language
     ORDER BY review_count DESC, language`,
    [appId],
  );

  return rows.map((row) => ({ language: row.language, reviewCount: Number(row.review_count) }));
}

type GameTopReviewsOptions = {
  /** Code langue Steam ; `null`/absent = toutes langues confondues. */
  language?: string | null;
  perSide?: number;
};

export async function getGameTopReviews(
  appId: number,
  { language = null, perSide = TOP_REVIEWS_PER_SIDE }: GameTopReviewsOptions = {},
): Promise<GameTopReview[]> {
  const { rows } = await pool.query(
    `WITH ranked AS (
       SELECT
         recommendation_id,
         app_id,
         review_text,
         language,
         voted_up,
         votes_up,
         votes_funny,
         weighted_vote_score,
         author_personaname,
         author_avatar,
         author_profile_url,
         author_playtime_at_review_minutes,
         author_last_played_at,
         rank_in_game,
         ROW_NUMBER() OVER (
           PARTITION BY voted_up
           ORDER BY rank_in_game, weighted_vote_score DESC, recommendation_id
         ) AS rank_in_side
       FROM marts.review_highlight
       WHERE app_id = $1 AND ($3::text IS NULL OR language = $3)
     )
     SELECT * FROM ranked
     WHERE rank_in_side <= $2
     ORDER BY voted_up DESC, rank_in_side`,
    [appId, perSide, language],
  );

  return rows.map((row) => ({
    recommendationId: Number(row.recommendation_id),
    appId: Number(row.app_id),
    reviewText: row.review_text,
    language: row.language,
    votedUp: row.voted_up,
    votesUp: row.votes_up,
    votesFunny: row.votes_funny,
    weightedVoteScore: Number(row.weighted_vote_score),
    authorPersonaname: row.author_personaname,
    authorAvatarUrl: `https://avatars.steamstatic.com/${row.author_avatar}_full.jpg`,
    authorPlaytimeAtReviewMinutes: row.author_playtime_at_review_minutes,
    authorLastPlayedAt: row.author_last_played_at
      ? (row.author_last_played_at as Date).toISOString()
      : null,
    reviewUrl: `${row.author_profile_url}recommended/${row.app_id}`,
    rankInGame: Number(row.rank_in_game),
  }));
}

// --- Home éditoriale -------------------------------------------------------
//
// Les requêtes ci-dessous n'alimentent que la home : les classements de
// fenêtre et les reviews récentes du carrousel de récompenses, le pouls du
// catalogue, et les jeux qui divisent. Voir `docs/home-data.md` pour le mart
// que lit chaque bloc et l'ordre de déploiement qu'ils imposent.

// Les classements de fenêtre lisent `marts.game_window_score`, qui porte déjà
// une ligne par (fenêtre, jeu) : plus besoin de réagréger le mart quotidien à
// chaque expiration de cache. Les fenêtres y sont ancrées sur la dernière date
// ingérée, jamais sur `CURRENT_DATE` — le pipeline peut avoir des jours de
// retard, et un ancrage sur « aujourd'hui » rendrait un podium vide.
//
// Valeurs internes, jamais dérivées d'une entrée utilisateur : leur
// interpolation dans le SQL est sûre. Le site écrit `year-to-date`, le mart
// `year_to_date`.
const WINDOW_NAME: Record<ReviewWindow, string> = {
  week: "week",
  month: "month",
  "year-to-date": "year_to_date",
};

const WINDOW_ORDER: Record<WindowRankingSort, string> = {
  best: "s.pct_positive DESC, s.total_reviews DESC, s.app_id",
  worst: "s.pct_positive ASC, s.total_reviews DESC, s.app_id",
  "most-reviewed": "s.total_reviews DESC, s.app_id",
};

type RankedWindowRow = {
  app_id: string;
  game_name: string;
  cover_url: string | null;
  reviews: string;
  pct_positive: string;
  total_reviews: string;
  starts_on: string;
  ends_on: string;
};

export type WindowRankingOptions = {
  limit: number;
  /** Plancher de volume *dans la fenêtre*. */
  minReviews: number;
  /**
   * Plafond sur le total que Steam déclare, toutes périodes confondues : la
   * « pépite cachée » doit être un jeu confidentiel, pas un succès en forme.
   */
  maxTotalReviews?: number;
};

export function windowRankingQuery(
  window: ReviewWindow,
  sort: WindowRankingSort,
  { limit, minReviews, maxTotalReviews }: WindowRankingOptions,
): { text: string; values: unknown[] } {
  return {
    text: `SELECT
       s.app_id,
       g.game_name,
       g.cover_url,
       s.total_reviews AS reviews,
       s.pct_positive,
       g.total_reviews,
       TO_CHAR(s.starts_on, 'YYYY-MM-DD') AS starts_on,
       TO_CHAR(s.ends_on, 'YYYY-MM-DD') AS ends_on
     FROM marts.game_window_score s
     JOIN marts.game_stats g ON g.steam_app_id = s.app_id
     WHERE s.window_name = $1
       AND s.total_reviews >= $3
       AND ($4::bigint IS NULL OR g.total_reviews < $4)
       AND g.cover_url IS NOT NULL
     ORDER BY ${WINDOW_ORDER[sort]}
     LIMIT $2`,
    values: [WINDOW_NAME[window], limit, minReviews, maxTotalReviews ?? null],
  };
}

/**
 * Un classement sur une fenêtre glissante : les jeux jugés sur les seuls avis
 * *reçus pendant la fenêtre*. Rien à voir avec `getRankedGames`, qui classe sur
 * le score cumulé depuis la sortie du jeu.
 *
 * `minReviews` est le garde-fou habituel : sur sept jours, une poignée d'avis
 * suffirait sinon à sacrer un jeu confidentiel à 100 %.
 *
 * Les jeux sans jaquette sont écartés : la home est une vitrine, et une
 * fenêtre courte fait remonter des titres qu'IGDB ne couvre pas encore — le
 * héros et les tuiles du podium se retrouvaient alors sur un cadre vide.
 */
export async function getWindowRanking(
  window: ReviewWindow,
  sort: WindowRankingSort,
  options: WindowRankingOptions,
): Promise<RankedWindow> {
  const query = windowRankingQuery(window, sort, options);
  const { rows } = await pool.query<RankedWindowRow>(query.text, query.values);

  return {
    startsOn: rows[0]?.starts_on ?? null,
    endsOn: rows[0]?.ends_on ?? null,
    games: rows.map((row) => ({
      appId: Number(row.app_id),
      name: row.game_name,
      coverUrl: row.cover_url,
      reviews: Number(row.reviews),
      pctPositive: Number(row.pct_positive),
      totalReviews: Number(row.total_reviews),
    })),
  };
}

/** Le meilleur de la fenêtre : le podium de la home, et « Best of <année> ». */
export async function getTopRatedGamesInWindow(
  window: ReviewWindow,
  limit: number,
  minReviews: number,
): Promise<RankedWindow> {
  return getWindowRanking(window, "best", { limit, minReviews });
}

type WindowMoverRow = {
  app_id: string;
  game_name: string;
  cover_url: string | null;
  reviews: string;
  pct_positive: string;
  previous_pct_positive: string;
  delta_pts: string;
  starts_on: string;
  ends_on: string;
  direction: "up" | "down";
};

// La semaine contre la semaine d'avant, toutes deux pré-agrégées par le mart :
// une jointure sur `app_id`, sans rien réagréger. Les deux bouts du classement
// reviennent d'un coup, et chacun ne garde que les écarts du bon signe — une
// semaine où rien ne remonte n'a pas de « comeback » à montrer.
export function windowMoversQuery(minReviews: number): { text: string; values: unknown[] } {
  return {
    text: `WITH deltas AS (
       SELECT
         w.app_id,
         g.game_name,
         g.cover_url,
         w.total_reviews AS reviews,
         w.pct_positive,
         p.pct_positive AS previous_pct_positive,
         ROUND((w.pct_positive - p.pct_positive) * 100, 2) AS delta_pts,
         TO_CHAR(w.starts_on, 'YYYY-MM-DD') AS starts_on,
         TO_CHAR(w.ends_on, 'YYYY-MM-DD') AS ends_on
       FROM marts.game_window_score w
       JOIN marts.game_window_score p ON p.app_id = w.app_id AND p.window_name = 'previous_week'
       JOIN marts.game_stats g ON g.steam_app_id = w.app_id
       WHERE w.window_name = 'week'
         AND w.total_reviews >= $1
         AND p.total_reviews >= $1
         AND g.cover_url IS NOT NULL
     )
     (SELECT *, 'up' AS direction FROM deltas WHERE delta_pts > 0
      ORDER BY delta_pts DESC, reviews DESC, app_id LIMIT 1)
     UNION ALL
     (SELECT *, 'down' AS direction FROM deltas WHERE delta_pts < 0
      ORDER BY delta_pts ASC, reviews DESC, app_id LIMIT 1)`,
    values: [minReviews],
  };
}

/**
 * Le plus beau retour en grâce et la pire chute de la semaine, en points de
 * part positive. `minReviews` est exigé des deux côtés : un écart tiré de dix
 * avis la semaine d'avant ne dirait rien du jeu.
 */
export async function getWindowMovers(minReviews: number): Promise<WindowMovers> {
  const query = windowMoversQuery(minReviews);
  const { rows } = await pool.query<WindowMoverRow>(query.text, query.values);

  const toMover = (row: WindowMoverRow | undefined): WindowMover | null =>
    row
      ? {
          appId: Number(row.app_id),
          name: row.game_name,
          coverUrl: row.cover_url,
          reviews: Number(row.reviews),
          pctPositive: Number(row.pct_positive),
          previousPctPositive: Number(row.previous_pct_positive),
          deltaPts: Number(row.delta_pts),
          startsOn: row.starts_on,
          endsOn: row.ends_on,
        }
      : null;

  return {
    up: toMover(rows.find((row) => row.direction === "up")),
    down: toMover(rows.find((row) => row.direction === "down")),
  };
}

type WindowReviewHighlightRow = {
  category: "funny" | "helpful";
  rank: number;
  recommendation_id: string;
  app_id: string;
  game_name: string;
  cover_url: string | null;
  review_text: string;
  voted_up: boolean;
  votes_up: string;
  votes_funny: string;
  author_personaname: string;
  author_playtime_at_review_minutes: string;
  created_at: Date;
  starts_on: string;
  ends_on: string;
};

export function windowReviewHighlightsQuery(
  window: "week" | "month",
  language: string,
): { text: string; values: unknown[] } {
  return {
    text: `SELECT
       h.category,
       h.rank,
       h.recommendation_id,
       h.app_id,
       g.game_name,
       g.cover_url,
       h.review_text,
       h.voted_up,
       h.votes_up,
       h.votes_funny,
       h.author_personaname,
       h.author_playtime_at_review_minutes,
       h.created_at,
       TO_CHAR(h.starts_on, 'YYYY-MM-DD') AS starts_on,
       TO_CHAR(h.ends_on, 'YYYY-MM-DD') AS ends_on
     FROM marts.review_window_highlight h
     JOIN marts.game_stats g ON g.steam_app_id = h.app_id
     WHERE h.window_name = $1 AND h.language = $2
     ORDER BY h.category, h.rank`,
    values: [window, language],
  };
}

/**
 * Les reviews récentes les plus drôles et les plus utiles d'une fenêtre, rangs
 * 1 à 5 de chaque catégorie. La home n'en montre qu'une par catégorie, mais
 * une même review peut gagner les deux : c'est l'appelant qui choisit, et il
 * lui faut les rangs suivants pour ne pas la montrer deux fois.
 *
 * Le mart ne garde déjà qu'une review par jeu et par classement ; il porte le
 * texte, donc on filtre sur l'index (window_name, category, language, rank).
 */
export async function getWindowReviewHighlights(
  window: "week" | "month",
  language = "english",
): Promise<WindowReviewHighlights> {
  const query = windowReviewHighlightsQuery(window, language);
  const { rows } = await pool.query<WindowReviewHighlightRow>(query.text, query.values);

  const toHighlight = (row: WindowReviewHighlightRow): WindowReviewHighlight => ({
    rank: Number(row.rank),
    recommendationId: Number(row.recommendation_id),
    appId: Number(row.app_id),
    gameName: row.game_name,
    coverUrl: row.cover_url,
    reviewText: row.review_text,
    votedUp: row.voted_up,
    votesUp: Number(row.votes_up),
    votesFunny: Number(row.votes_funny),
    authorPersonaname: row.author_personaname,
    authorPlaytimeAtReviewMinutes: Number(row.author_playtime_at_review_minutes),
    createdAt: (row.created_at as Date).toISOString(),
    startsOn: row.starts_on,
    endsOn: row.ends_on,
  });

  return {
    funny: rows.filter((row) => row.category === "funny").map(toHighlight),
    helpful: rows.filter((row) => row.category === "helpful").map(toHighlight),
  };
}

/**
 * Le camp dont doit venir la citation d'une récompense : `any` laisse les deux
 * camps concourir, pour une récompense qui ne juge pas le verdict (le jeu le
 * plus commenté de la semaine, par exemple).
 */
export type AwardReviewSentiment = "positive" | "negative" | "any";

/**
 * Comment départager les reviews : `top` reprend le classement du mart (le
 * meilleur de chaque langue d'abord), `helpful` prend simplement celle que le
 * plus de monde a votée utile.
 */
export type AwardReviewOrder = "top" | "helpful";

export type AwardReviewOptions = {
  language?: string;
  sentiment?: AwardReviewSentiment;
  order?: AwardReviewOrder;
  /** Bornes de la fenêtre ; absentes, la citation se cherche sur toujours. */
  startsOn?: string | null;
  endsOn?: string | null;
};

const AWARD_REVIEW_ORDER: Record<AwardReviewOrder, string> = {
  top: "rh.rank_in_game, rh.weighted_vote_score DESC, rh.recommendation_id",
  helpful: "rh.votes_up DESC, rh.weighted_vote_score DESC, rh.recommendation_id",
};

/**
 * La citation d'une récompense du carrousel : une seule review, choisie dans
 * la fenêtre de la récompense et du camp qu'elle annonce.
 *
 * Le filtre de date n'entre dans le SQL que si la fenêtre est donnée, et c'est
 * voulu : il porte sur `review_highlight.created_at`, une colonne que le mart
 * n'a pas toujours remontée en base. Sans fenêtre, la requête ne la nomme même
 * pas — le repli « toutes périodes confondues » tient donc encore quand la
 * lecture par fenêtre, elle, échoue.
 */
export function awardReviewQuery(
  appId: number,
  { language = "english", sentiment = "positive", order = "top", startsOn = null, endsOn = null }: AwardReviewOptions,
): { text: string; values: unknown[] } {
  const values: unknown[] = [appId, language];
  const filters = ["rh.app_id = $1", "rh.language = $2"];

  if (sentiment !== "any") {
    values.push(sentiment === "positive");
    filters.push(`rh.voted_up = $${values.length}`);
  }

  if (startsOn && endsOn) {
    values.push(startsOn, endsOn);
    filters.push(`rh.created_at::date BETWEEN $${values.length - 1}::date AND $${values.length}::date`);
  }

  return {
    text: `SELECT ${REVIEW_HIGHLIGHT_COLUMNS}
     FROM marts.review_highlight rh
     WHERE ${filters.join("\n       AND ")}
     ORDER BY ${AWARD_REVIEW_ORDER[order]}
     LIMIT 1`,
    values,
  };
}

/**
 * La review à citer sous une récompense, ou `null` quand le mart n'en a retenu
 * aucune qui réponde au critère — l'appelant élargit alors, ou se passe de
 * citation.
 */
export async function getAwardReview(appId: number, options: AwardReviewOptions): Promise<GameTopReview | null> {
  const query = awardReviewQuery(appId, options);
  const { rows } = await pool.query<TopReviewRow>(query.text, query.values);

  const row = rows[0];
  return row ? mapTopReviewRow(row) : null;
}

/**
 * Les jeux qui divisent : score le plus proche de 50 %, à gros volume. Le
 * seuil compte double ici — un jeu à 12 avis tombe sur 50 % par hasard, un jeu
 * à 50 000 avis y tombe parce que ses joueurs ne sont vraiment pas d'accord.
 *
 * Jaquette obligatoire, comme pour les podiums : la rubrique montre le n°1 en
 * grand, cadre vide compris s'il n'en a pas.
 */
export async function getPolarisedGames(limit: number, minReviews = 5000): Promise<GameStats[]> {
  const { rows } = await pool.query(
    `SELECT ${GAME_STATS_COLUMNS} FROM marts.game_stats
     WHERE total_reviews >= $2 AND cover_url IS NOT NULL
     ORDER BY ABS(pct_positive_reviews - 50), total_reviews DESC, steam_app_id
     LIMIT $1`,
    [limit, minReviews],
  );

  return rows.map(mapGameStatsRow);
}

/**
 * Le pouls du catalogue : une ligne par jour, tous jeux confondus, sur les
 * douze derniers mois calendaires. Le bandeau de la home en tire trois choses
 * (courbe de sentiment mensuelle, barres des 31 derniers jours, avis de la
 * semaine) — d'où une seule requête plutôt que trois. Le découpage se fait
 * ensuite en mémoire, dans `@/lib/cataloguePulse`.
 *
 * Elle lit `catalogue_review_trend_daily`, qui est exactement ce
 * `GROUP BY review_date` fait une fois par le pipeline, et non le mart par
 * (jeu, jour) : la même question posée à celui-ci réagrégeait trois millions
 * de lignes pour en rendre trois cent cinquante.
 *
 * Comme ailleurs, la fenêtre s'ancre sur la dernière date du mart et non sur
 * `CURRENT_DATE` : le pipeline peut avoir des jours de retard.
 */
export function catalogueTrendQuery(): { text: string; values: unknown[] } {
  return {
    text: `WITH bounds AS (
       SELECT MAX(review_date) AS latest FROM marts.catalogue_review_trend_daily
     )
     SELECT
       TO_CHAR(t.review_date, 'YYYY-MM-DD') AS review_date,
       t.total_reviews AS reviews,
       t.total_positive AS positive
     FROM marts.catalogue_review_trend_daily t, bounds b
     WHERE t.review_date >= (DATE_TRUNC('month', b.latest) - INTERVAL '11 months')::date
       AND t.review_date <= b.latest
     ORDER BY t.review_date`,
    values: [],
  };
}

export async function getCatalogueTrend(): Promise<CatalogueTrendDay[]> {
  const query = catalogueTrendQuery();
  const { rows } = await pool.query<{ review_date: string; reviews: string; positive: string }>(
    query.text,
    query.values,
  );

  return rows.map((row) => ({
    date: row.review_date,
    reviews: Number(row.reviews),
    positive: Number(row.positive),
  }));
}

// --- Catalogue de `/charts` ------------------------------------------------
//
// La page de classements montre le catalogue en grille de jaquettes, trié
// selon l'une des six entrées de `CHART_FILTERS`. Cinq d'entre elles ne sont
// qu'un ORDER BY sur `marts.game_stats` ; `trending` doit comparer deux
// fenêtres de trente jours, que `marts.game_window_score` porte déjà.

// Clés internes, jamais dérivées d'une entrée utilisateur (`isChartFilterKey`
// valide la query string en amont) : leur interpolation dans le SQL est sûre.
const CATALOGUE_ORDER: Record<Exclude<CatalogueSort, "trending">, string> = {
  "most-reviewed": "total_reviews DESC, steam_app_id",
  "best-rated": "pct_positive_reviews DESC, total_reviews DESC, steam_app_id",
  "worst-rated": "pct_positive_reviews ASC, total_reviews DESC, steam_app_id",
  polarised: "ABS(pct_positive_reviews - 50), total_reviews DESC, steam_app_id",
  recent: "first_release_date DESC NULLS LAST, total_reviews DESC, steam_app_id",
};

type CatalogueRow = {
  steam_app_id: string;
  game_name: string;
  cover_url: string | null;
  total_reviews: string;
  pct_positive_reviews: string;
  delta_pct?: string | null;
};

function mapCatalogueRow(row: CatalogueRow): CatalogueGame {
  return {
    appId: Number(row.steam_app_id),
    name: row.game_name,
    coverUrl: row.cover_url,
    totalReviews: Number(row.total_reviews),
    pctPositive: Number(row.pct_positive_reviews) / 100,
    ...(row.delta_pct == null ? {} : { deltaPct: Number(row.delta_pct) }),
  };
}

// Le classement `trending` et le héros de `/charts` posent la même question —
// de combien la part positive d'un jeu a bougé en trente jours — donc la même
// que `getTrendingGames` : `MONTH_DELTAS_CTE` les sert tous les trois. La
// jaquette, elle, n'est exigée qu'ici : une grille de jaquettes n'a rien à
// faire d'un jeu qui n'en a pas, là où le podium de la home cite le jeu par
// son nom.

export type CatalogueQuery = {
  sort: CatalogueSort;
  limit: number;
  offset?: number;
  /** Filtre sur le nom du jeu, tel que saisi dans le champ de la page. */
  search?: string;
  /** Plancher de volume : au-dessous, un score ne dit plus rien du jeu. */
  minReviews?: number;
  /** Plafond de volume, pour la rubrique « Hidden gems » seulement. */
  maxReviews?: number;
  /**
   * Plancher de score, de 0 à 100. « Hidden gems » s'en sert pour ne montrer
   * que des jeux réellement adorés : sans lui, la rubrique remplit ses huit
   * cases coûte que coûte et finit par y mettre un jeu à 34 %, sous un titre
   * qui promet le contraire.
   */
  minPct?: number;
};

/**
 * Une page de la grille. On lit toujours une ligne de plus que demandé : elle
 * ne sert qu'à savoir s'il existe une page suivante, et évite un COUNT(*) sur
 * tout le catalogue à chaque changement de tri.
 *
 * Jaquette obligatoire, comme sur les podiums de la home : une grille de
 * jaquettes n'a rien à faire d'un jeu qui n'en a pas, il n'y laisserait qu'un
 * rectangle vide.
 */
export function cataloguePageQuery({
  sort,
  limit,
  offset = 0,
  search,
  minReviews = 1,
  maxReviews,
  minPct,
}: CatalogueQuery): { text: string; values: unknown[] } {
  const query = search?.trim() || null;
  // On lit toujours une ligne de plus que demandé : elle ne sert qu'à savoir
  // s'il existe une page suivante.
  const probe = limit + 1;

  if (sort === "trending") {
    return {
      text: `${MONTH_DELTAS_CTE}
         SELECT
           app_id AS steam_app_id,
           game_name,
           cover_url,
           total_reviews,
           recent_pct AS pct_positive_reviews,
           delta_pct
         FROM deltas
         WHERE cover_url IS NOT NULL
           AND ($4::text IS NULL OR game_name ILIKE '%' || $4 || '%')
           AND ($5::numeric IS NULL OR recent_pct >= $5)
         ORDER BY delta_pct DESC, recent_reviews DESC, app_id
         LIMIT $1 OFFSET $3`,
      values: [probe, minReviews, offset, query, minPct ?? null],
    };
  }

  return {
    text: `SELECT steam_app_id, game_name, cover_url, total_reviews, pct_positive_reviews
         FROM marts.game_stats
         WHERE total_reviews >= $3
           AND ($5::bigint IS NULL OR total_reviews <= $5)
           AND ($6::numeric IS NULL OR pct_positive_reviews >= $6)
           AND cover_url IS NOT NULL
           AND ($4::text IS NULL OR game_name ILIKE '%' || $4 || '%')
         ORDER BY ${CATALOGUE_ORDER[sort]}
         LIMIT $1 OFFSET $2`,
    values: [probe, offset, minReviews, query, maxReviews ?? null, minPct ?? null],
  };
}

export async function getCataloguePage(params: CatalogueQuery): Promise<CataloguePage> {
  const { limit } = params;
  const catalogueQuery = cataloguePageQuery(params);

  const { rows } = await pool.query<CatalogueRow>(
    catalogueQuery.text,
    catalogueQuery.values,
  );

  return { games: rows.slice(0, limit).map(mapCatalogueRow), hasNext: rows.length > limit };
}

/**
 * La variation sur trente jours des seuls jeux affichés. La grille la montre
 * sur chaque vignette, tous tris confondus, et c'est la seule lecture que
 * `/charts` ne cache pas : elle dépend de la page affichée, donc elle part à
 * chaque chargement. Elle lit les deux lignes que `game_window_score` porte
 * déjà pour chaque jeu, par l'index `app_id`.
 *
 * Un jeu absent de la réponse n'a pas assez d'avis de part et d'autre de la
 * bascule : sa vignette s'affiche alors sans variation, plutôt qu'avec un
 * écart tiré de trois avis.
 */
export function recentDeltasQuery(
  appIds: number[],
  minReviewsPerWindow: number,
): { text: string; values: unknown[] } {
  return {
    text: `SELECT
       m.app_id,
       ROUND((m.pct_positive - p.pct_positive) * 100, 1) AS delta_pct
     FROM marts.game_window_score m
     JOIN marts.game_window_score p ON p.app_id = m.app_id AND p.window_name = 'previous_month'
     WHERE m.window_name = 'month'
       AND m.app_id = ANY($1::bigint[])
       AND m.total_reviews >= $2 AND p.total_reviews >= $2`,
    values: [appIds, minReviewsPerWindow],
  };
}

export async function getRecentDeltas(
  appIds: number[],
  minReviewsPerWindow = 30,
): Promise<Map<number, number>> {
  if (appIds.length === 0) return new Map();

  const query = recentDeltasQuery(appIds, minReviewsPerWindow);
  const { rows } = await pool.query<{ app_id: string; delta_pct: string }>(query.text, query.values);

  return new Map(rows.map((row) => [Number(row.app_id), Number(row.delta_pct)]));
}
