import { pool } from "@/lib/db";
import type {
  CatalogueTrendDay,
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
// ranking. Both ends of the ranking come back at once: the comparison itself is
// the expensive part (two aggregations over the whole trend table), so asking for
// gainers and droppers separately would pay for it twice.
//
// The window is anchored to the mart's own latest `review_date`, not wall-clock
// `CURRENT_DATE` — the pipeline can lag behind today by days or weeks, and anchoring
// to "today" would silently return an empty window whenever it does.
export async function getTrendingGames(
  limit: number,
  minReviewsPerWindow = 30,
): Promise<TrendingGames> {
  const { rows } = await pool.query<TrendingGameRow & { direction: "up" | "down" }>(
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
     ),
     deltas AS (
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
     )
     (SELECT *, 'up' AS direction FROM deltas ORDER BY delta_pct DESC LIMIT $1)
     UNION ALL
     (SELECT *, 'down' AS direction FROM deltas ORDER BY delta_pct ASC LIMIT $1)`,
    [limit, minReviewsPerWindow],
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
// Les trois requêtes ci-dessous n'alimentent que la home : un podium sur une
// fenêtre glissante, le pouls du catalogue, et les jeux qui divisent. Toutes
// lisent des marts existants ; voir `docs/home-data.md` pour les modèles qui
// manquent encore en amont et ce qu'ils feraient gagner.

// Chaque fenêtre est ancrée sur la dernière date du mart, jamais sur
// `CURRENT_DATE` : le pipeline peut avoir plusieurs jours de retard, et une
// fenêtre calée sur « aujourd'hui » renverrait alors un podium vide.
// Valeurs internes, jamais dérivées d'une entrée utilisateur : leur
// interpolation dans le SQL est sûre.
const WINDOW_STARTS_ON: Record<ReviewWindow, string> = {
  week: "(b.latest - INTERVAL '6 days')::date",
  month: "(b.latest - INTERVAL '29 days')::date",
  "year-to-date": "DATE_TRUNC('year', b.latest)::date",
};

type RankedWindowRow = {
  app_id: string;
  game_name: string;
  cover_url: string | null;
  reviews: string;
  pct_positive: string;
  starts_on: string;
  ends_on: string;
};

/**
 * Le meilleur de la fenêtre : les jeux dont les avis *reçus pendant la
 * fenêtre* sont les plus positifs. Rien à voir avec `getRankedGames`, qui
 * classe sur le score cumulé depuis la sortie du jeu.
 *
 * `minReviews` est le garde-fou habituel : sur sept jours, une poignée d'avis
 * suffirait sinon à sacrer un jeu confidentiel à 100 %.
 *
 * Les jeux sans jaquette sont écartés : la home est une vitrine, et une
 * fenêtre courte fait remonter des titres qu'IGDB ne couvre pas encore — le
 * héros et les tuiles du podium se retrouvaient alors sur un cadre vide.
 */
export async function getTopRatedGamesInWindow(
  window: ReviewWindow,
  limit: number,
  minReviews: number,
): Promise<RankedWindow> {
  const { rows } = await pool.query<RankedWindowRow>(
    `WITH bounds AS (
       SELECT MAX(review_date) AS latest FROM marts.game_review_trend_daily
     ),
     win AS (
       SELECT ${WINDOW_STARTS_ON[window]} AS starts_on, b.latest AS ends_on FROM bounds b
     ),
     scored AS (
       SELECT
         t.app_id,
         SUM(t.total_reviews) AS reviews,
         SUM(t.total_positive) AS positive
       FROM marts.game_review_trend_daily t, win w
       WHERE t.review_date BETWEEN w.starts_on AND w.ends_on
       GROUP BY t.app_id
       HAVING SUM(t.total_reviews) >= $2
     )
     SELECT
       s.app_id,
       g.game_name,
       g.cover_url,
       s.reviews,
       ROUND(s.positive::numeric / NULLIF(s.reviews, 0) * 100, 1) AS pct_positive,
       TO_CHAR(w.starts_on, 'YYYY-MM-DD') AS starts_on,
       TO_CHAR(w.ends_on, 'YYYY-MM-DD') AS ends_on
     FROM scored s
     JOIN marts.game_stats g ON g.steam_app_id = s.app_id
     CROSS JOIN win w
     WHERE g.cover_url IS NOT NULL
     ORDER BY pct_positive DESC, s.reviews DESC, s.app_id
     LIMIT $1`,
    [limit, minReviews],
  );

  return {
    startsOn: rows[0]?.starts_on ?? null,
    endsOn: rows[0]?.ends_on ?? null,
    games: rows.map((row) => ({
      appId: Number(row.app_id),
      name: row.game_name,
      coverUrl: row.cover_url,
      reviews: Number(row.reviews),
      pctPositive: Number(row.pct_positive) / 100,
    })),
  };
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
 * semaine) — d'où une seule requête plutôt que trois : l'agrégation balaie la
 * même tranche de `game_review_trend_daily` à chaque fois, et c'est elle qui
 * coûte. Le découpage se fait ensuite en mémoire, dans `@/lib/cataloguePulse`.
 */
export async function getCatalogueTrend(): Promise<CatalogueTrendDay[]> {
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

  return rows.map((row) => ({
    date: row.review_date,
    reviews: Number(row.reviews),
    positive: Number(row.positive),
  }));
}
