import { describe, expect, it } from "vitest";
import { dailyVolume, monthlySentiment, reviewsInLastDays } from "@/lib/cataloguePulse";
import type { CatalogueTrendDay } from "@/lib/data/types";

function day(date: string, reviews: number, positive: number): CatalogueTrendDay {
  return { date, reviews, positive };
}

describe("monthlySentiment", () => {
  it("regroupe les jours par mois calendaire", () => {
    const points = monthlySentiment([
      day("2026-01-05", 100, 80),
      day("2026-01-31", 100, 60),
      day("2026-02-01", 50, 50),
    ]);

    expect(points).toEqual([
      { month: "2026-01-01", pctPositive: 0.7 },
      { month: "2026-02-01", pctPositive: 1 },
    ]);
  });

  it("pondère par le volume, pas par le nombre de jours", () => {
    const [point] = monthlySentiment([day("2026-03-01", 1, 0), day("2026-03-02", 999, 999)]);

    expect(point.pctPositive).toBeCloseTo(0.999, 3);
  });

  it("ne garde que les derniers mois demandés, dans l'ordre chronologique", () => {
    const points = monthlySentiment(
      [day("2025-11-01", 10, 5), day("2025-12-01", 10, 5), day("2026-01-01", 10, 5)],
      2,
    );

    expect(points.map((p) => p.month)).toEqual(["2025-12-01", "2026-01-01"]);
  });

  it("renvoie 0 plutôt que NaN sur un mois sans avis", () => {
    expect(monthlySentiment([day("2026-01-01", 0, 0)])).toEqual([
      { month: "2026-01-01", pctPositive: 0 },
    ]);
  });

  it("ne rend rien quand la série est vide", () => {
    expect(monthlySentiment([])).toEqual([]);
  });
});

describe("dailyVolume", () => {
  it("garde les derniers jours, du plus ancien au plus récent", () => {
    const days = [day("2026-01-01", 1, 1), day("2026-01-02", 2, 2), day("2026-01-03", 3, 3)];

    expect(dailyVolume(days, 2)).toEqual([2, 3]);
  });

  it("rend toute la série quand elle est plus courte que demandé", () => {
    expect(dailyVolume([day("2026-01-01", 7, 4)], 31)).toEqual([7]);
  });
});

describe("reviewsInLastDays", () => {
  it("somme les avis de la fin de la série", () => {
    const days = [day("2026-01-01", 10, 5), day("2026-01-02", 20, 10), day("2026-01-03", 30, 15)];

    expect(reviewsInLastDays(days, 2)).toBe(50);
  });

  it("vaut 0 sur une série vide", () => {
    expect(reviewsInLastDays([], 7)).toBe(0);
  });
});
