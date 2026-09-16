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

/**
 * Ce que le site a réellement chargé d'un jeu, par opposition aux totaux que
 * Steam déclare dans `game_stats` : le bandeau de la fiche annonce l'assiette
 * de l'analyse avant de montrer le moindre chiffre.
 */
export type GameCoverage = {
  /** Avis présents en base pour ce jeu, et non ceux que Steam compte. */
  loadedReviews: number;
  /** Nombre de langues dans lesquelles il a été commenté. */
  languageCount: number;
  /** Date du dernier avis chargé, `null` quand le jeu n'en a aucun. */
  latestReviewOn: string | null;
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
  /** Avis réellement chargés en base, et non le total que Steam déclare. */
  storedReviews: number;
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

/**
 * Fenêtre d'un podium de la home, toujours ancrée sur la dernière date
 * présente dans `marts.game_review_trend_daily` — jamais sur `CURRENT_DATE`,
 * que le pipeline peut avoir des jours de retard à rejoindre.
 */
export type ReviewWindow = "week" | "month" | "year-to-date";

export type WindowedGame = {
  appId: number;
  name: string;
  coverUrl: string | null;
  /** Avis reçus dans la fenêtre, pas le total du jeu. */
  reviews: number;
  /** Part d'avis positifs dans la fenêtre, de 0 à 1. */
  pctPositive: number;
};

export type RankedWindow = {
  /** `null` quand aucun jeu ne passe le seuil : la fenêtre reste inconnue. */
  startsOn: string | null;
  endsOn: string | null;
  games: WindowedGame[];
};

/** Une journée du catalogue entier, tous jeux confondus. */
export type CatalogueTrendDay = {
  date: string; // ISO, e.g. "2026-09-11"
  reviews: number;
  positive: number;
};

/**
 * Les entrées du catalogue proposées par `/charts`. Toutes se lisent dans
 * `marts.game_stats` d'un seul ORDER BY ; `trending` seul doit comparer deux
 * fenêtres de `game_review_trend_daily`.
 */
export type CatalogueSort =
  | "most-reviewed"
  | "best-rated"
  | "worst-rated"
  | "trending"
  | "polarised"
  | "recent";

/** Une vignette de la grille : de quoi dessiner la jaquette et son verdict. */
export type CatalogueGame = {
  appId: number;
  name: string;
  coverUrl: string | null;
  totalReviews: number;
  /** Part d'avis positifs, de 0 à 1. */
  pctPositive: number;
  /**
   * Variation de la part positive sur 30 jours, en points. Absente quand le
   * jeu n'a pas assez d'avis de part et d'autre de la bascule pour qu'une
   * comparaison veuille dire quelque chose.
   */
  deltaPct?: number;
};

/**
 * Une page de la grille. `hasNext` vient d'une ligne lue en trop, et non d'un
 * COUNT(*) sur tout le catalogue.
 */
export type CataloguePage = {
  games: CatalogueGame[];
  hasNext: boolean;
};
