import { describe, expect, it } from "vitest";
import { estimateRevenue, reviewMultiplier } from "@/lib/revenue";

const base = { totalReviews: 1000, priceUsd: 20, isFree: false, firstReleaseDate: "2024-03-01" };

describe("reviewMultiplier", () => {
  it("retient 30 ventes par avis depuis 2022", () => {
    expect(reviewMultiplier("2022-01-01")).toBe(30);
    expect(reviewMultiplier("2026-09-01")).toBe(30);
  });

  it("monte pour les jeux plus anciens", () => {
    expect(reviewMultiplier("2021-12-31")).toBe(40);
    expect(reviewMultiplier("2019-06-01")).toBe(50);
    expect(reviewMultiplier("2017-06-01")).toBe(60);
    expect(reviewMultiplier("2012-06-01")).toBe(70);
  });

  it("prend le ratio récent quand la date manque", () => {
    expect(reviewMultiplier(null)).toBe(30);
  });
});

describe("estimateRevenue", () => {
  it("multiplie avis, ratio et prix effectif", () => {
    expect(estimateRevenue(base)).toEqual({ multiplier: 30, unitsSold: 30_000, grossRevenueUsd: 450_000 });
  });

  it("ne rend rien pour un jeu gratuit, sans prix ou sans avis", () => {
    expect(estimateRevenue({ ...base, isFree: true })).toBeNull();
    expect(estimateRevenue({ ...base, priceUsd: null })).toBeNull();
    expect(estimateRevenue({ ...base, totalReviews: 0 })).toBeNull();
  });
});
