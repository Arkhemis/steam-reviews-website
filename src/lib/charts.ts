import type { CatalogueSort } from "@/lib/data/types";

// Les cinq entrées du catalogue proposées par `/charts`. Partagées parce que
// la home les compte (« N rankings » dans « Dig deeper ») : une liste
// dupliquée finirait par annoncer un chiffre que la page ne tient pas.
//
// `note` sert deux fois : sous le titre de la rubrique « All games », et comme
// sous-titre de la rubrique de la page d'accueil qui y renvoie.

type ChartFilter = {
  key: CatalogueSort;
  label: string;
  note: string;
  /**
   * Plancher de volume. Un classement au score (`best-rated`, `polarised`) n'a
   * de sens qu'au-dessus d'un certain nombre d'avis : à douze avis, un jeu
   * tombe à 100 % ou à 50 % par accident. Les classements au volume ou à la
   * date n'en ont pas besoin.
   */
  minReviews: number;
};

export const CHART_FILTERS: readonly ChartFilter[] = [
  { key: "most-reviewed", label: "Most reviewed", note: "by total reviews collected", minReviews: 1 },
  { key: "best-rated", label: "Best rated", note: "highest positive share", minReviews: 500 },
  { key: "worst-rated", label: "Worst rated", note: "lowest positive share", minReviews: 500 },
  { key: "trending", label: "Trending", note: "biggest 30-day shift", minReviews: 30 },
  { key: "polarised", label: "Most polarised", note: "closest to a 50/50 split", minReviews: 5000 },
  { key: "recent", label: "Recently released", note: "newest games in the catalogue", minReviews: 1 },
];

export type ChartFilterKey = CatalogueSort;

/** Le tri servi quand la query string n'en demande aucun. */
export const DEFAULT_CHART_FILTER: ChartFilterKey = "most-reviewed";

export function isChartFilterKey(value: string | undefined): value is ChartFilterKey {
  return CHART_FILTERS.some((f) => f.key === value);
}

export function chartFilter(key: ChartFilterKey): ChartFilter {
  return CHART_FILTERS.find((f) => f.key === key) ?? CHART_FILTERS[0];
}

/**
 * L'adresse d'un état de la page. Les trois paramètres voyagent ensemble :
 * changer de tri sans emporter le filtre en cours renverrait le lecteur sur un
 * catalogue entier qu'il venait justement de restreindre.
 *
 * Le tri par défaut et la première page ne s'écrivent pas dans l'URL : `/charts`
 * reste l'adresse canonique de la page.
 */
export function chartsHref({
  filter = DEFAULT_CHART_FILTER,
  q,
  page = 1,
}: {
  filter?: ChartFilterKey;
  q?: string;
  page?: number;
} = {}): string {
  const params = new URLSearchParams();
  if (filter !== DEFAULT_CHART_FILTER) params.set("filter", filter);
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/charts?${query}` : "/charts";
}
