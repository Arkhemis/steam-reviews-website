import { describe, expect, it } from "vitest";
import {
  CHART_FILTERS,
  DEFAULT_CHART_FILTER,
  chartFilter,
  chartsHref,
  isChartFilterKey,
} from "@/lib/charts";

describe("chartsHref", () => {
  it("rend l'adresse nue pour le tri par défaut, première page", () => {
    expect(chartsHref()).toBe("/charts");
    expect(chartsHref({ filter: DEFAULT_CHART_FILTER })).toBe("/charts");
    expect(chartsHref({ filter: DEFAULT_CHART_FILTER, page: 1 })).toBe("/charts");
  });

  it("nomme les autres tris", () => {
    expect(chartsHref({ filter: "polarised" })).toBe("/charts?filter=polarised");
    expect(chartsHref({ filter: "recent" })).toBe("/charts?filter=recent");
  });

  // Changer de tri sans emporter le filtre en cours renverrait le lecteur sur
  // un catalogue entier qu'il venait justement de restreindre.
  it("emporte le filtre et la page avec le tri", () => {
    expect(chartsHref({ filter: "trending", q: "baldur", page: 3 })).toBe(
      "/charts?filter=trending&q=baldur&page=3",
    );
  });

  it("garde le filtre même sur le tri par défaut", () => {
    expect(chartsHref({ q: "baldur" })).toBe("/charts?q=baldur");
  });

  it("échappe ce que le lecteur a tapé", () => {
    expect(chartsHref({ q: "a&b=c" })).toBe("/charts?q=a%26b%3Dc");
  });

  it("n'écrit pas la première page dans l'URL", () => {
    expect(chartsHref({ filter: "best-rated", page: 1 })).toBe("/charts?filter=best-rated");
  });
});

describe("isChartFilterKey", () => {
  it("reconnaît les huit tris de la page", () => {
    expect(CHART_FILTERS.map((f) => f.key)).toEqual([
      "most-reviewed",
      "best-rated",
      "worst-rated",
      "trending",
      "polarised",
      "recent",
      "hidden-gem",
      "most-despised",
    ]);
    expect(CHART_FILTERS.every((f) => isChartFilterKey(f.key))).toBe(true);
  });

  // Le tri par défaut ouvre la liste : c'est lui que sert `/charts` nue, et
  // celui sur lequel la page retombe quand la query string dit n'importe quoi.
  it("ouvre la liste par le tri par défaut", () => {
    expect(CHART_FILTERS[0].key).toBe(DEFAULT_CHART_FILTER);
  });

  // La valeur vient de la query string : n'importe quoi peut arriver, et la
  // page doit retomber sur son tri par défaut plutôt que d'interpoler une clé
  // inconnue dans son ORDER BY.
  it("rejette tout le reste", () => {
    expect(isChartFilterKey(undefined)).toBe(false);
    expect(isChartFilterKey("")).toBe(false);
    expect(isChartFilterKey("Best-Rated")).toBe(false);
    expect(isChartFilterKey("total_reviews DESC; DROP TABLE marts.game_stats")).toBe(false);
  });
});

describe("chartFilter", () => {
  it("rend le libellé et le seuil du tri demandé", () => {
    expect(chartFilter("polarised")).toMatchObject({
      label: "Most polarised",
      note: "closest to a 50/50 split",
    });
  });

  // Un classement au score ne veut rien dire à faible volume : à douze avis,
  // un jeu tombe à 100 % ou à 0 % par accident — et c'est le bas du classement
  // que le hasard peuple le plus volontiers.
  it("exige du volume des classements au score, pas des autres", () => {
    expect(chartFilter("best-rated").minReviews).toBeGreaterThan(1);
    expect(chartFilter("worst-rated").minReviews).toBeGreaterThan(1);
    expect(chartFilter("polarised").minReviews).toBeGreaterThan(1);
    expect(chartFilter("most-reviewed").minReviews).toBe(1);
    expect(chartFilter("recent").minReviews).toBe(1);
  });

  // Les deux classements au score sont l'exact miroir l'un de l'autre : un
  // seuil différent ferait juger les deux bouts du catalogue à des barres
  // différentes.
  it("juge les deux bouts du catalogue au même seuil", () => {
    expect(chartFilter("worst-rated").minReviews).toBe(chartFilter("best-rated").minReviews);
  });
});
