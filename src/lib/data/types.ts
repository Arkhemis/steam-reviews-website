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
  annotation?: string; // optional callout, e.g. "Patch controversé"
};

export type GameLanguageDistribution = {
  appId: number;
  language: string;
  reviewCount: number;
  pctOfTotal: number;
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
