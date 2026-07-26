import {
  BALDURS_GATE_3_APP_ID,
  baldursGate3LanguageDistribution,
  baldursGate3ReviewTrends,
  baldursGate3Stats,
  baldursGate3TopReviews,
} from "@/lib/data/fixtures/baldursGate3";
import type {
  GameLanguageDistribution,
  GameReviewTrend,
  GameStats,
  GameTopReview,
} from "@/lib/data/types";

// TODO(future plan): once `marts.game_stats` etc. exist, replace these
// in-memory lookups with SQL queries against Postgres. The function
// signatures below are the contract the rest of the app depends on.

const STATS_BY_APP_ID: Record<number, GameStats> = {
  [BALDURS_GATE_3_APP_ID]: baldursGate3Stats,
};

const TRENDS_BY_APP_ID: Record<number, GameReviewTrend[]> = {
  [BALDURS_GATE_3_APP_ID]: baldursGate3ReviewTrends,
};

const LANGUAGES_BY_APP_ID: Record<number, GameLanguageDistribution[]> = {
  [BALDURS_GATE_3_APP_ID]: baldursGate3LanguageDistribution,
};

const TOP_REVIEWS_BY_APP_ID: Record<number, GameTopReview[]> = {
  [BALDURS_GATE_3_APP_ID]: baldursGate3TopReviews,
};

export async function getGameStats(appId: number): Promise<GameStats | null> {
  return STATS_BY_APP_ID[appId] ?? null;
}

export async function getGameReviewTrends(appId: number): Promise<GameReviewTrend[]> {
  return TRENDS_BY_APP_ID[appId] ?? [];
}

export async function getGameLanguageDistribution(appId: number): Promise<GameLanguageDistribution[]> {
  return LANGUAGES_BY_APP_ID[appId] ?? [];
}

export async function getGameTopReviews(appId: number): Promise<GameTopReview[]> {
  return TOP_REVIEWS_BY_APP_ID[appId] ?? [];
}
