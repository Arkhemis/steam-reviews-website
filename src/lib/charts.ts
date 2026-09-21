import type { CatalogueSort } from "@/lib/data/types";
import { RANKINGS, type Ranking, isRankingKey, ranking } from "@/lib/rankings";

// Les entrées du catalogue proposées par `/charts`. Elles ne vivent plus ici :
// `RANKINGS` (`src/lib/rankings.ts`) décrit chaque classement une fois, pour la
// vitrine de la home comme pour cette page. Ce module n'en garde que ce qui
// regarde l'URL et la barre de filtres.

export type ChartFilter = Ranking;

export const CHART_FILTERS: readonly ChartFilter[] = RANKINGS;

export type ChartFilterKey = CatalogueSort;

/** Le tri servi quand la query string n'en demande aucun. */
export const DEFAULT_CHART_FILTER: ChartFilterKey = "most-reviewed";

export function isChartFilterKey(value: string | undefined): value is ChartFilterKey {
  return isRankingKey(value);
}

export function chartFilter(key: ChartFilterKey): ChartFilter {
  return ranking(key);
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
