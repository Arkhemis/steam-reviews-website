import type { GameLanguageDistribution, GameReviewTrend } from "@/lib/data/types";

export const BALDURS_GATE_3_APP_ID = 1086940;

export const baldursGate3ReviewTrends: GameReviewTrend[] = [
  { appId: BALDURS_GATE_3_APP_ID, periodMonth: "2023-08-01", reviewsInPeriod: 21000, positiveInPeriod: 18900, pctPositivePeriod: 0.9 },
  { appId: BALDURS_GATE_3_APP_ID, periodMonth: "2023-09-01", reviewsInPeriod: 15000, positiveInPeriod: 13650, pctPositivePeriod: 0.91 },
  { appId: BALDURS_GATE_3_APP_ID, periodMonth: "2023-10-01", reviewsInPeriod: 9000, positiveInPeriod: 7830, pctPositivePeriod: 0.87 },
  {
    appId: BALDURS_GATE_3_APP_ID,
    periodMonth: "2023-11-01",
    reviewsInPeriod: 7000,
    positiveInPeriod: 3500,
    pctPositivePeriod: 0.5,
    annotation: "Patch controversé",
  },
  { appId: BALDURS_GATE_3_APP_ID, periodMonth: "2023-12-01", reviewsInPeriod: 6500, positiveInPeriod: 5525, pctPositivePeriod: 0.85 },
  { appId: BALDURS_GATE_3_APP_ID, periodMonth: "2024-01-01", reviewsInPeriod: 5000, positiveInPeriod: 4500, pctPositivePeriod: 0.9 },
  { appId: BALDURS_GATE_3_APP_ID, periodMonth: "2024-02-01", reviewsInPeriod: 4200, positiveInPeriod: 3948, pctPositivePeriod: 0.94 },
  { appId: BALDURS_GATE_3_APP_ID, periodMonth: "2024-03-01", reviewsInPeriod: 3900, positiveInPeriod: 3705, pctPositivePeriod: 0.95 },
  { appId: BALDURS_GATE_3_APP_ID, periodMonth: "2024-04-01", reviewsInPeriod: 3600, positiveInPeriod: 3492, pctPositivePeriod: 0.97 },
  { appId: BALDURS_GATE_3_APP_ID, periodMonth: "2024-05-01", reviewsInPeriod: 3400, positiveInPeriod: 3298, pctPositivePeriod: 0.97 },
  { appId: BALDURS_GATE_3_APP_ID, periodMonth: "2024-06-01", reviewsInPeriod: 3100, positiveInPeriod: 3007, pctPositivePeriod: 0.97 },
  { appId: BALDURS_GATE_3_APP_ID, periodMonth: "2024-07-01", reviewsInPeriod: 2900, positiveInPeriod: 2842, pctPositivePeriod: 0.98 },
];

export const baldursGate3LanguageDistribution: GameLanguageDistribution[] = [
  { appId: BALDURS_GATE_3_APP_ID, language: "english", reviewCount: 45454, pctOfTotal: 0.52 },
  { appId: BALDURS_GATE_3_APP_ID, language: "schinese", reviewCount: 12238, pctOfTotal: 0.14 },
  { appId: BALDURS_GATE_3_APP_ID, language: "french", reviewCount: 7867, pctOfTotal: 0.09 },
  { appId: BALDURS_GATE_3_APP_ID, language: "german", reviewCount: 6119, pctOfTotal: 0.07 },
  { appId: BALDURS_GATE_3_APP_ID, language: "russian", reviewCount: 5245, pctOfTotal: 0.06 },
  { appId: BALDURS_GATE_3_APP_ID, language: "brazilian", reviewCount: 3496, pctOfTotal: 0.04 },
  { appId: BALDURS_GATE_3_APP_ID, language: "spanish", reviewCount: 2622, pctOfTotal: 0.03 },
  { appId: BALDURS_GATE_3_APP_ID, language: "polish", reviewCount: 1748, pctOfTotal: 0.02 },
  { appId: BALDURS_GATE_3_APP_ID, language: "japanese", reviewCount: 1748, pctOfTotal: 0.02 },
  { appId: BALDURS_GATE_3_APP_ID, language: "italian", reviewCount: 875, pctOfTotal: 0.01 },
];
