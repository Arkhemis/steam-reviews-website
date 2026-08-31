import { describe, expect, it } from "vitest";
import { bucketGlobalLanguages, getCountryColor, getRegionColor, LANGUAGE_COLORS } from "@/lib/map";

const FALLBACK = "var(--series-fallback)";

describe("getCountryColor", () => {
  it("colors France by French", () => {
    expect(getCountryColor("250")).toBe(LANGUAGE_COLORS.french);
  });

  it("colors Germany by German", () => {
    expect(getCountryColor("276")).toBe(LANGUAGE_COLORS.german);
  });

  it("colors Francophone African countries by French", () => {
    expect(getCountryColor("450")).toBe(LANGUAGE_COLORS.french); // Madagascar
    expect(getCountryColor("686")).toBe(LANGUAGE_COLORS.french); // Senegal
    expect(getCountryColor("384")).toBe(LANGUAGE_COLORS.french); // Côte d'Ivoire
    expect(getCountryColor("180")).toBe(LANGUAGE_COLORS.french); // Dem. Rep. Congo
  });

  it("colors Anglophone African/Caribbean/Pacific countries by English", () => {
    expect(getCountryColor("566")).toBe(LANGUAGE_COLORS.english); // Nigeria
    expect(getCountryColor("404")).toBe(LANGUAGE_COLORS.english); // Kenya
    expect(getCountryColor("388")).toBe(LANGUAGE_COLORS.english); // Jamaica
  });

  it("falls back to the neutral color for an unmapped country", () => {
    expect(getCountryColor("999")).toBe(FALLBACK);
  });

  it("does not force a country into an inaccurate bucket just because it's not english/french/german/russian/schinese/brazilian", () => {
    expect(getCountryColor("392")).toBe(FALLBACK); // Japan (Japanese, untracked)
    expect(getCountryColor("724")).toBe(FALLBACK); // Spain (Spanish, untracked)
  });
});

describe("getRegionColor", () => {
  it("colors Québec by French and the rest of Canada by English", () => {
    expect(getRegionColor("canada", "Québec")).toBe(LANGUAGE_COLORS.french);
    expect(getRegionColor("canada", "Ontario")).toBe(LANGUAGE_COLORS.english);
  });

  it("colors Swiss cantons by their dominant language", () => {
    expect(getRegionColor("switzerland", "Genève")).toBe(LANGUAGE_COLORS.french);
    expect(getRegionColor("switzerland", "Zürich")).toBe(LANGUAGE_COLORS.german);
    expect(getRegionColor("switzerland", "Ticino")).toBe(LANGUAGE_COLORS.italian);
  });

  it("colors Belgian provinces by their dominant language, Brussels as French", () => {
    expect(getRegionColor("belgium", "Hainaut")).toBe(LANGUAGE_COLORS.french);
    expect(getRegionColor("belgium", "Antwerp")).toBe(LANGUAGE_COLORS.dutch);
    expect(getRegionColor("belgium", "Brussels")).toBe(LANGUAGE_COLORS.french);
  });

  it("colors Finnish regions, with Ostrobothnia as Swedish-speaking", () => {
    expect(getRegionColor("finland", "Ostrobothnia")).toBe(LANGUAGE_COLORS.swedish);
    expect(getRegionColor("finland", "Uusimaa")).toBe(LANGUAGE_COLORS.finnish);
  });

  it("falls back to the neutral color for an unknown region name", () => {
    expect(getRegionColor("finland", "Atlantis")).toBe(FALLBACK);
  });

  it("falls back to the neutral color for a missing region name", () => {
    expect(getRegionColor("canada", undefined)).toBe(FALLBACK);
  });
});

describe("bucketGlobalLanguages", () => {
  it("keeps known languages, sorted by pctOfTotal descending", () => {
    const rows = [
      { language: "german", reviewCount: 5, pctOfTotal: 0.05 },
      { language: "english", reviewCount: 41, pctOfTotal: 0.41 },
      { language: "french", reviewCount: 6, pctOfTotal: 0.06 },
    ];
    expect(bucketGlobalLanguages(rows)).toEqual([
      { key: "english", reviewCount: 41, pctOfTotal: 0.41 },
      { key: "french", reviewCount: 6, pctOfTotal: 0.06 },
      { key: "german", reviewCount: 5, pctOfTotal: 0.05 },
    ]);
  });

  it("sums unrecognized languages into a single 'other' row appended last", () => {
    const rows = [
      { language: "english", reviewCount: 41, pctOfTotal: 0.41 },
      { language: "polish", reviewCount: 3, pctOfTotal: 0.03 },
      { language: "turkish", reviewCount: 2, pctOfTotal: 0.02 },
    ];
    expect(bucketGlobalLanguages(rows)).toEqual([
      { key: "english", reviewCount: 41, pctOfTotal: 0.41 },
      { key: "other", reviewCount: 5, pctOfTotal: 0.05 },
    ]);
  });

  it("omits the 'other' row entirely when every language is recognized", () => {
    const rows = [{ language: "english", reviewCount: 41, pctOfTotal: 0.41 }];
    expect(bucketGlobalLanguages(rows).some((row) => row.key === "other")).toBe(false);
  });

  it("returns an empty array for empty input", () => {
    expect(bucketGlobalLanguages([])).toEqual([]);
  });
});
