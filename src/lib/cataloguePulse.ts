import type { CatalogueTrendDay } from "@/lib/data/types";

// Le bandeau de la home tire trois lectures d'une seule série quotidienne
// (`getCatalogueTrend`) : la courbe de sentiment mensuelle, les barres des 31
// derniers jours et le compteur de la semaine. Le découpage vit ici, hors du
// composant et hors de SQL : c'est de l'arithmétique pure, donc testable sans
// base ni rendu.

/** Part d'avis positifs d'un mois calendaire, de 0 à 1. */
export type SentimentPoint = {
  month: string; // ISO, premier du mois, e.g. "2026-09-01"
  pctPositive: number;
};

/**
 * Agrège la série quotidienne en mois calendaires. Le dernier mois est
 * forcément partiel (la série s'arrête à la dernière date du mart) : ce n'est
 * pas gênant pour une part, qui est un ratio, alors que ça le serait pour un
 * volume.
 */
export function monthlySentiment(days: CatalogueTrendDay[], months = 12): SentimentPoint[] {
  const buckets = new Map<string, { reviews: number; positive: number }>();

  for (const day of days) {
    const month = `${day.date.slice(0, 7)}-01`;
    const bucket = buckets.get(month) ?? { reviews: 0, positive: 0 };
    bucket.reviews += day.reviews;
    bucket.positive += day.positive;
    buckets.set(month, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-months)
    .map(([month, { reviews, positive }]) => ({
      month,
      pctPositive: reviews > 0 ? positive / reviews : 0,
    }));
}

/** Les `count` derniers jours de la série, du plus ancien au plus récent. */
export function dailyVolume(days: CatalogueTrendDay[], count = 31): number[] {
  return days.slice(-count).map((day) => day.reviews);
}

/** Total d'avis sur les `count` derniers jours de la série. */
export function reviewsInLastDays(days: CatalogueTrendDay[], count = 7): number {
  return days.slice(-count).reduce((total, day) => total + day.reviews, 0);
}
