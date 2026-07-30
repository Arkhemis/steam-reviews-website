import { pool } from "@/lib/db";
import {
  BALDURS_GATE_3_APP_ID,
  baldursGate3LanguageDistribution,
  baldursGate3ReviewTrends,
} from "@/lib/data/fixtures/baldursGate3";
import type {
  GameLanguageDistribution,
  GameReviewTrend,
  GameStats,
  GameTopReview,
} from "@/lib/data/types";

// TODO(future plan): once les marts trends/languages existent, remplacer ces
// lookups en mémoire par des requêtes SQL contre Postgres. Les signatures
// ci-dessous sont le contrat dont dépend le reste de l'app.

const TRENDS_BY_APP_ID: Record<number, GameReviewTrend[]> = {
  [BALDURS_GATE_3_APP_ID]: baldursGate3ReviewTrends,
};

const LANGUAGES_BY_APP_ID: Record<number, GameLanguageDistribution[]> = {
  [BALDURS_GATE_3_APP_ID]: baldursGate3LanguageDistribution,
};

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

export async function getTopGames(limit: number, search?: string): Promise<GameStats[]> {
  const query = search?.trim();
  const { rows } = await pool.query(
    `SELECT ${GAME_STATS_COLUMNS} FROM marts.game_stats
     WHERE total_reviews > 0 AND ($2::text IS NULL OR game_name ILIKE '%' || $2 || '%')
     ORDER BY total_reviews DESC
     LIMIT $1`,
    [limit, query || null],
  );

  return rows.map(mapGameStatsRow);
}

export async function getGameReviewTrends(appId: number): Promise<GameReviewTrend[]> {
  return TRENDS_BY_APP_ID[appId] ?? [];
}

export async function getGameLanguageDistribution(appId: number): Promise<GameLanguageDistribution[]> {
  return LANGUAGES_BY_APP_ID[appId] ?? [];
}

export async function getGameTopReviews(appId: number): Promise<GameTopReview[]> {
  const { rows } = await pool.query(
    `SELECT
       recommendation_id,
       app_id,
       review_text,
       language,
       voted_up,
       votes_up,
       weighted_vote_score,
       author_playtime_at_review_minutes,
       rank_in_game
     FROM marts.review_highlight
     WHERE app_id = $1
     ORDER BY voted_up DESC, rank_in_game`,
    [appId],
  );

  return rows.map((row) => ({
    recommendationId: Number(row.recommendation_id),
    appId: Number(row.app_id),
    reviewText: row.review_text,
    language: row.language,
    votedUp: row.voted_up,
    votesUp: row.votes_up,
    weightedVoteScore: Number(row.weighted_vote_score),
    authorPlaytimeAtReviewMinutes: row.author_playtime_at_review_minutes,
    rankInGame: Number(row.rank_in_game),
  }));
}
