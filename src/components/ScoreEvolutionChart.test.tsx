import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScoreEvolutionChart } from "@/components/ScoreEvolutionChart";
import type { GameReviewTrend } from "@/lib/data/types";

const trends: GameReviewTrend[] = [
  { appId: 1, periodMonth: "2024-01-01", reviewsInPeriod: 100, positiveInPeriod: 90, pctPositivePeriod: 0.9 },
  {
    appId: 1,
    periodMonth: "2024-02-01",
    reviewsInPeriod: 100,
    positiveInPeriod: 50,
    pctPositivePeriod: 0.5,
    annotation: "Patch controversé",
  },
];

describe("ScoreEvolutionChart", () => {
  it("renders an SVG line chart with the annotation label visible", () => {
    render(<ScoreEvolutionChart trends={trends} />);
    expect(screen.getByRole("img", { name: /évolution du score positif/i })).toBeInTheDocument();
    expect(screen.getByText("Patch controversé")).toBeInTheDocument();
  });
});
