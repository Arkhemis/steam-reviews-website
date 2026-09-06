export type GameStats = {
  appId: number;
  name: string;
  genres: string[];
  developers: string[];
  publishers: string[];
  coverUrl: string | null;
  firstReleaseDate: string | null;
  totalReviews: number;
  reviewScore: number;
  pctPositive: number;
  playtimeMedianMinutes: number;
  pctSteamDeck: number;
  pctRefunded: number;
};

export type GameReviewTrend = {
  appId: number;
  periodMonth: string; // ISO date, first of month, e.g. "2023-09-01"
  reviewsInPeriod: number;
  positiveInPeriod: number;
  pctPositivePeriod: number;
};

/**
 * Une annonce Steam retenue par `marts.game_event_highlight` (top 3 par an et
 * par jeu, catégories `news` et `update` seulement), affichée en repère sur la
 * courbe d'évolution du score.
 */
export type GameEvent = {
  appId: number;
  gid: string;
  startedOn: string; // ISO date, e.g. "2023-08-17"
  category: "news" | "update";
  headline: string;
  votesUp: number;
  votesDown: number;
  commentCount: number;
  imageUrl: string | null; // absent d'environ la moitié des annonces
  pctNegative: number; // part de votes négatifs, de 0 à 1
  isWellReceived: boolean; // faux au-delà de 25 % de négatifs, cf. le mart
};

export type GameLanguageDistribution = {
  appId: number;
  language: string;
  reviewCount: number;
  pctOfTotal: number;
};

export type LanguageReviewScore = {
  language: string;
  totalReviews: number;
  totalPositive: number;
  pctPositive: number;
  pctOfTotal: number;
};

export type SiteStats = {
  totalReviews: number;
  totalGames: number;
};

export type TrendingGame = {
  appId: number;
  name: string;
  coverUrl: string | null;
  recentReviews: number;
  recentPctPositive: number;
  previousPctPositive: number;
  deltaPct: number;
};

/** Biggest gainers and biggest droppers, from one pass over the trend table. */
export type TrendingGames = {
  up: TrendingGame[];
  down: TrendingGame[];
};

export type GameTopReview = {
  recommendationId: number;
  appId: number;
  reviewText: string;
  language: string;
  votedUp: boolean;
  votesUp: number;
  votesFunny: number;
  weightedVoteScore: number;
  authorPersonaname: string;
  authorAvatarUrl: string;
  authorPlaytimeAtReviewMinutes: number;
  authorLastPlayedAt: string | null;
  reviewUrl: string;
  rankInGame: number;
};

export type ReviewDuelSide = {
  game: GameStats;
  review: GameTopReview;
};

export type ReviewDuel = {
  positive: ReviewDuelSide;
  negative: ReviewDuelSide;
};

export type GameReviewLanguage = {
  language: string;
  reviewCount: number;
};
