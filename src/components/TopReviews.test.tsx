import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TopReviews } from "@/components/TopReviews";
import type { GameTopReview } from "@/lib/data/types";

const reviews: GameTopReview[] = [
  {
    recommendationId: 1,
    appId: 1,
    reviewText: "Chef-d'œuvre.",
    language: "french",
    votedUp: true,
    votesUp: 100,
    weightedVoteScore: 0.9,
    authorPlaytimeAtReviewMinutes: 600,
    rankInGame: 1,
  },
  {
    recommendationId: 2,
    appId: 1,
    reviewText: "Trop de bugs.",
    language: "french",
    votedUp: false,
    votesUp: 50,
    weightedVoteScore: 0.5,
    authorPlaytimeAtReviewMinutes: 120,
    rankInGame: 1,
  },
];

describe("TopReviews", () => {
  it("renders each review with its recommendation status", () => {
    render(<TopReviews reviews={reviews} />);
    expect(screen.getByText("Chef-d'œuvre.")).toBeInTheDocument();
    expect(screen.getByText("Recommandé")).toBeInTheDocument();
    expect(screen.getByText("Non recommandé")).toBeInTheDocument();
  });
});
