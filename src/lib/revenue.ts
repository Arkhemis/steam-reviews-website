/**
 * Estimation des ventes et du revenu brut d'un jeu à partir de ses avis Steam,
 * par la méthode Boxleiter : ventes ≈ avis × un multiplicateur, puis revenu ≈
 * ventes × prix effectif. C'est ce que font SteamDB, VG Insights ou Gamalytic
 * en première approximation — ces derniers affinent ensuite par régression
 * (genre, playtime, joueurs simultanés), ce que le site ne tente pas.
 *
 * L'ordre de grandeur est fiable, le chiffre exact ne l'est pas : un écart de
 * ±50 % sur un jeu isolé est courant.
 */

/**
 * Ventes par avis selon l'année de sortie. Le ratio a fondu à mesure que Steam
 * poussait à laisser un avis, et se tient autour de 30 depuis 2022 — médianes
 * des tables publiées (Carless, Birkett, VG Insights).
 */
const MULTIPLIER_BY_YEAR: { until: number; multiplier: number }[] = [
  { until: 2016, multiplier: 70 },
  { until: 2018, multiplier: 60 },
  { until: 2019, multiplier: 50 },
  { until: 2021, multiplier: 40 },
];
const RECENT_MULTIPLIER = 30;

/**
 * Part du prix de base réellement encaissée en moyenne : promos, prix
 * régionaux et bundles tirent le panier sous le prix affiché.
 */
export const EFFECTIVE_PRICE_RATIO = 0.75;

export type RevenueEstimate = {
  /** Ventes par avis retenues pour ce jeu. */
  multiplier: number;
  unitsSold: number;
  /** Revenu brut en dollars, avant la commission de Steam et les remboursements. */
  grossRevenueUsd: number;
};

export function reviewMultiplier(firstReleaseDate: string | null): number {
  if (!firstReleaseDate) return RECENT_MULTIPLIER;
  const year = Number(firstReleaseDate.slice(0, 4));
  return MULTIPLIER_BY_YEAR.find((step) => year <= step.until)?.multiplier ?? RECENT_MULTIPLIER;
}

/**
 * Rien à estimer pour un jeu gratuit, sans prix ou sans avis : le multiplicateur
 * ne vaut que pour des copies achetées.
 */
export function estimateRevenue(input: {
  totalReviews: number;
  priceUsd: number | null;
  isFree: boolean;
  firstReleaseDate: string | null;
}): RevenueEstimate | null {
  if (input.isFree || input.priceUsd === null || input.priceUsd <= 0 || input.totalReviews <= 0) return null;
  const multiplier = reviewMultiplier(input.firstReleaseDate);
  const unitsSold = input.totalReviews * multiplier;
  return {
    multiplier,
    unitsSold,
    grossRevenueUsd: unitsSold * input.priceUsd * EFFECTIVE_PRICE_RATIO,
  };
}
