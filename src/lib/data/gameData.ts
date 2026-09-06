import { pool } from "@/lib/db";
import type {
  GameLanguageDistribution,
  GameReviewLanguage,
  GameReviewTrend,
  GameStats,
  GameTopReview,
  LanguageReviewScore,
  ReviewDuel,
  SiteStats,
  TrendingGame,
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

export async function getSiteStats(): Promise<SiteStats> {
  const { rows } = await pool.query(
    `SELECT SUM(total_reviews) AS total_reviews, COUNT(*) AS total_games
     FROM marts.game_stats WHERE total_reviews > 0`,
  );

  return {
    totalReviews: Number(rows[0]?.total_reviews ?? 0),
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

// Compare the last 30 days of reviews against the 30 days before that, requiring
// a minimum volume on both sides so a single-digit review count can't swing the
// ranking. `direction` picks the biggest positive-rate gainers vs the biggest drops.
//
// The window is anchored to the mart's own latest `review_date`, not wall-clock
// `CURRENT_DATE` — the pipeline can lag behind today by days or weeks, and anchoring
// to "today" would silently return an empty window whenever it does.
export async function getTrendingGames(
  direction: "up" | "down",
  limit: number,
  minReviewsPerWindow = 30,
): Promise<TrendingGame[]> {
  const { rows } = await pool.query<TrendingGameRow>(
    `WITH bounds AS (
       SELECT MAX(review_date) AS latest FROM marts.game_review_trend_daily
     ),
     recent AS (
       SELECT t.app_id, SUM(t.total_reviews) AS reviews, SUM(t.total_positive) AS positive
       FROM marts.game_review_trend_daily t, bounds
       WHERE t.review_date > bounds.latest - INTERVAL '30 days'
       GROUP BY t.app_id
     ),
     previous AS (
       SELECT t.app_id, SUM(t.total_reviews) AS reviews, SUM(t.total_positive) AS positive
       FROM marts.game_review_trend_daily t, bounds
       WHERE t.review_date > bounds.latest - INTERVAL '60 days'
         AND t.review_date <= bounds.latest - INTERVAL '30 days'
       GROUP BY t.app_id
     )
     SELECT
       r.app_id,
       g.game_name,
       g.cover_url,
       r.reviews AS recent_reviews,
       ROUND(r.positive::numeric / NULLIF(r.reviews, 0) * 100, 1) AS recent_pct,
       ROUND(p.positive::numeric / NULLIF(p.reviews, 0) * 100, 1) AS previous_pct,
       ROUND(
         (r.positive::numeric / NULLIF(r.reviews, 0) - p.positive::numeric / NULLIF(p.reviews, 0)) * 100,
         1
       ) AS delta_pct
     FROM recent r
     JOIN previous p ON p.app_id = r.app_id
     JOIN marts.game_stats g ON g.steam_app_id = r.app_id
     WHERE r.reviews >= $2 AND p.reviews >= $2
     ORDER BY delta_pct ${direction === "up" ? "DESC" : "ASC"}
     LIMIT $1`,
    [limit, minReviewsPerWindow],
  );

  return rows.map((row) => ({
    appId: Number(row.app_id),
    name: row.game_name,
    coverUrl: row.cover_url,
    recentReviews: Number(row.recent_reviews),
    recentPctPositive: Number(row.recent_pct) / 100,
    previousPctPositive: Number(row.previous_pct) / 100,
    deltaPct: Number(row.delta_pct),
  }));
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
export async function getReviewDuel(minReviews = 5000): Promise<ReviewDuel | null> {
  const { rows } = await pool.query<TopReviewRow & GameStatsRow & { side: "positive" | "negative" }>(
    `(SELECT
        ${REVIEW_HIGHLIGHT_COLUMNS},
        g.steam_app_id, g.game_name, g.genres, g.developers, g.publishers, g.cover_url,
        g.first_release_date, g.total_reviews, g.pct_positive_reviews, g.review_score,
        g.median_playtime_forever_minutes, g.pct_primarily_steam_deck, g.pct_refunded,
        'positive' AS side
      FROM marts.review_highlight rh
      JOIN marts.game_stats g ON g.steam_app_id = rh.app_id
      WHERE rh.rank_in_game = 1 AND rh.voted_up = true AND g.total_reviews > $1
      ORDER BY RANDOM()
      LIMIT 1)
     UNION ALL
     (SELECT
        ${REVIEW_HIGHLIGHT_COLUMNS},
        g.steam_app_id, g.game_name, g.genres, g.developers, g.publishers, g.cover_url,
        g.first_release_date, g.total_reviews, g.pct_positive_reviews, g.review_score,
        g.median_playtime_forever_minutes, g.pct_primarily_steam_deck, g.pct_refunded,
        'negative' AS side
      FROM marts.review_highlight rh
      JOIN marts.game_stats g ON g.steam_app_id = rh.app_id
      WHERE rh.rank_in_game = 1 AND rh.voted_up = false AND g.total_reviews > $1
      ORDER BY RANDOM()
      LIMIT 1)`,
    [minReviews],
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

type GameLanguageDistributionRow = {
  app_id: string;
  language: string;
  review_count: string;
  pct_of_total: string;
};

export async function getGameLanguageDistribution(appId: number): Promise<GameLanguageDistribution[]> {
  const { rows } = await pool.query<GameLanguageDistributionRow>(
    `SELECT app_id, language, review_count, pct_of_total
     FROM marts.game_language_distribution
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
