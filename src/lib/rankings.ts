import type { CatalogueSort, ReviewWindow, WindowRankingSort } from "@/lib/data/types";

// La liste des classements du site, en un seul endroit. Elle sert trois
// lecteurs : le carrousel de récompenses de la home (`homeAwards.ts`), les
// rubriques et les puces de filtre de `/charts` (`charts.ts`), et la couche
// d'accès aux données qui traduit chaque entrée en SQL (`gameData.ts`).
//
// Deux listes séparées finissaient par diverger : la vitrine de la home
// primait « Most hated » sans que `/charts` sache le classer. Ici, une
// catégorie décrit sa source une fois, et `rankings.test.ts` vérifie qu'aucune
// récompense de la vitrine n'est restée sans classement.

/**
 * Les récompenses du carrousel de la home. L'identité vit ici plutôt que dans
 * `homeAwards.ts` : c'est elle que `/charts` doit couvrir, la rédaction des
 * diapositives reste là-bas.
 */
export type AwardId =
  | "best-of-week"
  | "comeback"
  | "freefall"
  | "most-reviewed"
  | "funniest-review"
  | "most-helpful-review"
  | "best-of-year"
  | "most-hated"
  | "hidden-gem"
  | "nobody-agrees";

/**
 * Les deux récompenses qui priment une *review*, pas un jeu. Une rubrique de
 * huit jaquettes ne dirait rien d'un texte : elles restent l'exclusivité de la
 * home, et l'exclusion est nommée ici pour que le test de couverture sache
 * qu'elle est voulue.
 */
export const REVIEW_AWARDS = ["funniest-review", "most-helpful-review"] as const satisfies readonly AwardId[];

/** Les tris qui se lisent d'un seul ORDER BY sur `marts.game_stats`. */
export type StatsOrder = "most-reviewed" | "best-rated" | "worst-rated" | "polarised" | "recent";

/**
 * D'où sort un classement. Les trois formes correspondent aux trois requêtes
 * que `cataloguePageQuery` sait écrire :
 *
 * - `stats` : le score cumulé depuis la sortie du jeu, `marts.game_stats` ;
 * - `window` : les seuls avis reçus pendant une fenêtre, `game_window_score` ;
 * - `movers` : l'écart entre une fenêtre et la précédente, la même table
 *   jointe à elle-même.
 */
export type RankingSource =
  | { kind: "stats"; order: StatsOrder; maxReviews?: number; minPct?: number }
  | { kind: "window"; window: ReviewWindow; sort: WindowRankingSort; maxTotalReviews?: number }
  | { kind: "movers"; window: MoverWindow; direction: "up" | "down" };

/** Les deux fenêtres dont le mart porte aussi la précédente. */
export type MoverWindow = "week" | "month";

export type Ranking = {
  key: CatalogueSort;
  /** Libellé de la puce de filtre. */
  label: string;
  /**
   * La règle du classement, en quelques mots. Sert sous le titre « All games »
   * de `/charts` et comme sous-titre de la rubrique de la home qui y renvoie.
   */
  note: string;
  /**
   * Plancher de volume. Un classement au score n'a de sens qu'au-dessus d'un
   * certain nombre d'avis : à douze avis, un jeu tombe à 100 % ou à 50 % par
   * accident. Sur une fenêtre, le plancher porte sur les avis *de la fenêtre*.
   */
  minReviews: number;
  source: RankingSource;
  /** La récompense de la vitrine dont ce classement est le prolongement. */
  award?: AwardId;
  /**
   * La rubrique de huit jaquettes en tête de `/charts`. Un classement sans
   * rubrique reste joignable par sa puce de filtre.
   */
  shelf?: { title: string; note: string };
};

// Les seuils sont repris tels quels de la home : une rubrique qui sacrerait un
// autre jeu que la diapositive du même nom vaudrait mieux ne pas exister.
const WEEK_MIN_REVIEWS = 100;
const MONTH_MIN_REVIEWS = 500;
const YEAR_MIN_REVIEWS = 1000;
const MOVER_MIN_REVIEWS = 100;
const HIDDEN_GEM_MIN_REVIEWS = 50;
const HIDDEN_GEM_MAX_TOTAL_REVIEWS = 2000;
const POLARISED_MIN_REVIEWS = 5000;
const RATED_MIN_REVIEWS = 500;
const TRENDING_MIN_REVIEWS = 30;

export const RANKINGS: readonly Ranking[] = [
  // Les six classements de toujours. `most-reviewed` ouvre la liste : c'est le
  // tri servi quand la query string n'en demande aucun.
  {
    key: "most-reviewed",
    label: "Most reviewed",
    note: "by total reviews collected",
    minReviews: 1,
    source: { kind: "stats", order: "most-reviewed" },
  },
  {
    key: "best-rated",
    label: "Best rated",
    note: "highest positive share",
    minReviews: RATED_MIN_REVIEWS,
    source: { kind: "stats", order: "best-rated" },
  },
  {
    key: "worst-rated",
    label: "Worst rated",
    note: "lowest positive share",
    minReviews: RATED_MIN_REVIEWS,
    source: { kind: "stats", order: "worst-rated" },
  },
  {
    key: "trending",
    label: "Trending",
    note: "biggest 30-day shift",
    minReviews: TRENDING_MIN_REVIEWS,
    source: { kind: "movers", window: "month", direction: "up" },
  },
  {
    key: "polarised",
    label: "Most polarised",
    note: "closest to a 50/50 split",
    minReviews: POLARISED_MIN_REVIEWS,
    source: { kind: "stats", order: "polarised" },
    award: "nobody-agrees",
    shelf: { title: "Nobody agrees", note: "reviews split hardest" },
  },
  {
    key: "recent",
    label: "Recently released",
    note: "newest games in the catalogue",
    minReviews: 1,
    source: { kind: "stats", order: "recent" },
    shelf: { title: "Freshly released", note: "newest games in the catalogue" },
  },

  // Les sept classements fenêtrés, repris de la vitrine. Ils cohabitent avec
  // leurs homologues de toujours sans faire doublon : « Most hated » juge les
  // avis des trente derniers jours, « Worst rated » le score cumulé depuis la
  // sortie — deux jeux différents gagnent.
  {
    key: "best-of-week",
    label: "Best of the week",
    note: "highest positive share over the last 7 days",
    minReviews: WEEK_MIN_REVIEWS,
    source: { kind: "window", window: "week", sort: "best" },
    award: "best-of-week",
    shelf: { title: "Best of the week", note: "adored over the last 7 days" },
  },
  {
    key: "comeback",
    label: "Comeback",
    note: "biggest week-over-week gain",
    minReviews: MOVER_MIN_REVIEWS,
    source: { kind: "movers", window: "week", direction: "up" },
    award: "comeback",
    shelf: { title: "Comeback", note: "won their players back this week" },
  },
  {
    key: "freefall",
    label: "Freefall",
    note: "biggest week-over-week drop",
    minReviews: MOVER_MIN_REVIEWS,
    source: { kind: "movers", window: "week", direction: "down" },
    award: "freefall",
    shelf: { title: "Freefall", note: "lost their players this week" },
  },
  {
    key: "most-reviewed-week",
    label: "Most reviewed this week",
    note: "most reviews written over the last 7 days",
    minReviews: 1,
    source: { kind: "window", window: "week", sort: "most-reviewed" },
    award: "most-reviewed",
    shelf: { title: "Most reviewed this week", note: "what players are writing about" },
  },
  {
    key: "best-of-year",
    label: "Best of the year",
    note: "highest positive share written this year",
    minReviews: YEAR_MIN_REVIEWS,
    source: { kind: "window", window: "year-to-date", sort: "best" },
    award: "best-of-year",
    // Le titre porte l'année, que la page lit dans la fenêtre renvoyée par la
    // requête plutôt que dans l'horloge : le pipeline peut avoir du retard.
    shelf: { title: "Best of the year", note: "year to date" },
  },
  {
    key: "most-hated",
    label: "Most hated",
    note: "lowest positive share over the last 30 days",
    minReviews: MONTH_MIN_REVIEWS,
    source: { kind: "window", window: "month", sort: "worst" },
    award: "most-hated",
    shelf: { title: "Most hated", note: "despised over the last 30 days" },
  },
  {
    key: "hidden-gem",
    label: "Hidden gem",
    note: "adored this month, barely reviewed ever",
    minReviews: HIDDEN_GEM_MIN_REVIEWS,
    source: { kind: "window", window: "month", sort: "best", maxTotalReviews: HIDDEN_GEM_MAX_TOTAL_REVIEWS },
    award: "hidden-gem",
    shelf: { title: "Hidden gems", note: "adored, barely reviewed" },
  },
];

/**
 * L'ordre des rubriques en tête de `/charts` : celui du carrousel de la home,
 * pour que le lecteur qui arrive de la vitrine retrouve la même succession.
 * « Freshly released » ferme la marche — elle n'est pas une récompense.
 */
const SHELF_ORDER: readonly CatalogueSort[] = [
  "best-of-week",
  "comeback",
  "freefall",
  "most-reviewed-week",
  "best-of-year",
  "most-hated",
  "hidden-gem",
  "polarised",
  "recent",
];

export type RankingShelf = Ranking & { shelf: NonNullable<Ranking["shelf"]> };

export const RANKING_SHELVES: readonly RankingShelf[] = SHELF_ORDER.map((key) => {
  const entry = RANKINGS.find((r) => r.key === key);
  if (!entry?.shelf) throw new Error(`Ranking "${key}" has no shelf`);
  return entry as RankingShelf;
});

export function isRankingKey(value: string | undefined): value is CatalogueSort {
  return RANKINGS.some((r) => r.key === value);
}

/** Le classement d'une clé. Retombe sur le tri par défaut pour une clé inconnue. */
export function ranking(key: CatalogueSort): Ranking {
  return RANKINGS.find((r) => r.key === key) ?? RANKINGS[0];
}
