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

export type SteamAppType = "game" | "demo" | "mod" | "dlc" | "music" | "other";

/**
 * La fiche store Steam d'un jeu, telle que `game_stats` la reprend de
 * `game_detail`. Seule la page du jeu la lit : les listes s'en passent.
 */
export type GameStoreListing = {
  appType: SteamAppType;
  /** Prix de base en dollars, hors promo ; null si gratuit ou pas en vente. */
  priceUsd: number | null;
  isFree: boolean;
  isEarlyAccess: boolean;
  isComingSoon: boolean;
  /** Faux quand l'app a été retirée du store. */
  isAvailable: boolean;
  /**
   * Le jeu dont ce DLC dépend, quand il est dans `game_stats`. Réservé aux
   * DLC : Steam renseigne aussi un parent pour les playtests et quelques mods,
   * que la fiche ne présente pas comme des extensions.
   */
  parentGame: { appId: number; name: string } | null;
};

/** Un DLC tel que la fiche de son jeu parent le liste. */
export type GameDlc = {
  appId: number;
  name: string;
  coverUrl: string | null;
  /** Null quand Steam n'a pas encore compté d'avis pour ce DLC. */
  pctPositive: number | null;
  totalReviews: number;
  priceUsd: number | null;
  isFree: boolean;
};

/** Les DLC d'un jeu : les plus commentés, et le compte de tous les autres. */
export type GameDlcs = { dlcs: GameDlc[]; total: number };

/** `GameStats` plus la fiche store, null tant que Steam n'a pas été interrogé. */
export type GameProfile = GameStats & { store: GameStoreListing | null };

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
  /** Date de publication de la review, au format ISO. */
  createdAt: string;
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
 * que le pipeline peut avoir des jours de retard à rejoindre. Le mart
 * `game_window_score` les nomme en snake_case (`year_to_date`).
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
  /** Total que Steam déclare pour le jeu, toutes périodes confondues. */
  totalReviews: number;
};

/**
 * Ordre d'un classement de fenêtre : les mieux notés, les moins bien notés,
 * ou les plus commentés quel que soit leur verdict.
 */
export type WindowRankingSort = "best" | "worst" | "most-reviewed";

/**
 * Un jeu dont la part positive a bougé d'une semaine sur l'autre : les sept
 * derniers jours contre les sept d'avant, lus dans `game_window_score`.
 */
export type WindowMover = {
  appId: number;
  name: string;
  coverUrl: string | null;
  /** Avis reçus pendant la semaine en cours. */
  reviews: number;
  /** Part positive de la semaine en cours, de 0 à 1. */
  pctPositive: number;
  /** Part positive de la semaine précédente, de 0 à 1. */
  previousPctPositive: number;
  /** Écart entre les deux, en points (80 % → 62 % donne -18). */
  deltaPts: number;
  startsOn: string;
  endsOn: string;
};

/** Le plus beau retour et la pire chute, `null` quand il n'y en a pas. */
export type WindowMovers = {
  up: WindowMover | null;
  down: WindowMover | null;
};

/** Catégorie de `marts.review_window_highlight`. */
export type ReviewHighlightCategory = "funny" | "helpful";

/**
 * Une review récente retenue par `marts.review_window_highlight` : la mieux
 * classée de son jeu, puis classée parmi celles des autres jeux de la fenêtre.
 */
export type WindowReviewHighlight = {
  rank: number;
  recommendationId: number;
  appId: number;
  gameName: string;
  coverUrl: string | null;
  reviewText: string;
  votedUp: boolean;
  votesUp: number;
  votesFunny: number;
  authorPersonaname: string;
  authorPlaytimeAtReviewMinutes: number;
  createdAt: string;
  startsOn: string;
  endsOn: string;
};

/** Les classements d'une fenêtre, dans l'ordre des rangs (1 en tête). */
export type WindowReviewHighlights = Record<ReviewHighlightCategory, WindowReviewHighlight[]>;

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
 * Les entrées du catalogue proposées par `/charts`. Chacune décrit sa source
 * et ses bornes dans `RANKINGS` (`src/lib/rankings.ts`) : un ORDER BY sur
 * `marts.game_stats`, ou la comparaison de deux fenêtres de trente jours pour
 * `trending`.
 */
export type CatalogueSort =
  | "most-reviewed"
  | "best-rated"
  | "worst-rated"
  | "trending"
  | "polarised"
  | "recent"
  | "hidden-gem"
  | "most-despised";

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
