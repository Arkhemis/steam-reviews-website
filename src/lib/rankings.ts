import type { CatalogueSort } from "@/lib/data/types";

// La liste des classements du site, en un seul endroit. Elle sert trois
// lecteurs : le carrousel de récompenses de la home (`homeAwards.ts`), les
// rubriques et les puces de filtre de `/charts` (`charts.ts`), et la couche
// d'accès aux données qui traduit chaque entrée en SQL (`gameData.ts`).
//
// Deux listes séparées finissaient par diverger : la vitrine de la home
// primait « Most hated » sans que `/charts` sache le classer. Ici, une
// catégorie décrit sa source une fois, et `rankings.test.ts` vérifie qu'aucune
// récompense de la vitrine n'est restée sans classement.

/** Les tris qui se lisent d'un seul ORDER BY sur `marts.game_stats`. */
export type StatsOrder = "most-reviewed" | "best-rated" | "worst-rated" | "polarised" | "recent";

/**
 * D'où sort un classement, et à quelles bornes. C'est cette description qui
 * permet à une rubrique et à sa puce de filtre de servir la *même* liste : la
 * rubrique « Hidden gems » renvoyait vers `best-rated`, qui n'applique ni son
 * plafond de volume ni son plancher de score — le lecteur qui cliquait « see
 * all » tombait sur un autre classement que celui qu'il venait de parcourir.
 */
export type RankingSource =
  | { kind: "stats"; order: StatsOrder; maxReviews?: number; minPct?: number }
  | { kind: "movers" };

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
  /**
   * La rubrique de huit jaquettes en tête de `/charts`. Un classement sans
   * rubrique reste joignable par sa puce de filtre.
   */
  shelf?: { title: string; note: string };
};

// « Hidden gems » : adoré, mais peu commenté. Le plancher de volume écarte le
// jeu à douze avis qui affiche 100 % par accident ; le plafond écarte les
// mastodontes, qui n'ont rien de caché ; le plancher de score fait que la
// rubrique montre moins de huit jeux plutôt que d'y glisser un jeu médiocre
// sous un titre qui promet le contraire.
const GEM_MIN_REVIEWS = 500;
const GEM_MAX_REVIEWS = 200_000;
const GEM_MIN_PCT = 95;

// « Most despised » : le pendant négatif de la pépite. Le seuil compte double
// ici — un jeu à douze avis tombe à 3 % par accident, un jeu à cinq mille avis
// y tombe parce que ses joueurs le détestent vraiment. Au plancher de
// `worst-rated`, la rubrique ne montrerait que des asset flips inconnus.
const DESPISED_MIN_REVIEWS = 5000;

const POLARISED_MIN_REVIEWS = 5000;
const RATED_MIN_REVIEWS = 500;
const TRENDING_MIN_REVIEWS = 30;

export const RANKINGS: readonly Ranking[] = [
  // `most-reviewed` ouvre la liste : c'est le tri servi quand la query string
  // n'en demande aucun.
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
    source: { kind: "movers" },
  },
  {
    key: "polarised",
    label: "Most polarised",
    note: "closest to a 50/50 split",
    minReviews: POLARISED_MIN_REVIEWS,
    source: { kind: "stats", order: "polarised" },
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

  // Les deux classements bornés. Ils ne sont pas des doublons de `best-rated`
  // et `worst-rated` : ce sont eux que servent leurs rubriques, bornes
  // comprises, pour qu'un « see all » prolonge la rangée au lieu de renvoyer
  // sur une liste voisine.
  {
    key: "hidden-gem",
    label: "Hidden gems",
    note: "adored, barely reviewed",
    minReviews: GEM_MIN_REVIEWS,
    source: { kind: "stats", order: "best-rated", maxReviews: GEM_MAX_REVIEWS, minPct: GEM_MIN_PCT },
    shelf: { title: "Hidden gems", note: "adored, barely reviewed" },
  },
  {
    key: "most-despised",
    label: "Most despised",
    note: "lowest positive share, with the volume to prove it",
    minReviews: DESPISED_MIN_REVIEWS,
    source: { kind: "stats", order: "worst-rated" },
    shelf: { title: "Most despised", note: "loathed by the crowd, not by a handful" },
  },
];

/**
 * Les rangées en tête de `/charts`, dans leur ordre d'affichage. « Most
 * despised » suit « Hidden gems » : les deux se répondent, l'adoré confidentiel
 * et le détesté de masse.
 */
const SHELF_ORDER: readonly CatalogueSort[] = ["hidden-gem", "most-despised", "recent", "polarised"];

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
