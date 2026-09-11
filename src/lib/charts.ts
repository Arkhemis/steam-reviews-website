// Les classements proposés par `/charts`. Partagés parce que la home les
// compte (« N rankings » dans « Dig deeper ») : une liste dupliquée finirait
// par annoncer un chiffre que la page de classements ne tient pas.

export const CHART_FILTERS = [
  { key: "trending", label: "Trending" },
  { key: "best-rated", label: "Best rated" },
  { key: "most-reviewed", label: "Most reviewed" },
  { key: "worst-rated", label: "Worst rated" },
] as const;

export type ChartFilterKey = (typeof CHART_FILTERS)[number]["key"];

export function isChartFilterKey(value: string | undefined): value is ChartFilterKey {
  return CHART_FILTERS.some((f) => f.key === value);
}

/** `trending` est le classement par défaut : il vit sur `/charts` sans query. */
export function chartFilterHref(key: ChartFilterKey): string {
  return key === "trending" ? "/charts" : `/charts?filter=${key}`;
}
