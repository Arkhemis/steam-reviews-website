import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReviewBattle } from "@/components/ReviewBattle";
import type { GameTopReview } from "@/lib/data/types";

function makeReview(overrides: Partial<GameTopReview>): GameTopReview {
  return {
    recommendationId: 1,
    appId: 1,
    reviewText: "texte",
    language: "french",
    votedUp: true,
    votesUp: 10,
    votesFunny: 0,
    weightedVoteScore: 0.9,
    authorPersonaname: "Joueur",
    authorAvatarUrl: "https://avatars.steamstatic.com/placeholder_full.jpg",
    authorPlaytimeAtReviewMinutes: 600,
    authorLastPlayedAt: null,
    reviewUrl: "https://steamcommunity.com/profiles/1/recommended/1",
    rankInGame: 1,
    ...overrides,
  };
}

const reviews: GameTopReview[] = [
  makeReview({ recommendationId: 1, reviewText: "Positive rang 1", votedUp: true, rankInGame: 1 }),
  makeReview({ recommendationId: 2, reviewText: "Positive rang 2", votedUp: true, rankInGame: 2 }),
  makeReview({ recommendationId: 3, reviewText: "Positive rang 3", votedUp: true, rankInGame: 3 }),
  makeReview({ recommendationId: 4, reviewText: "Négative rang 1", votedUp: false, rankInGame: 1 }),
  makeReview({ recommendationId: 5, reviewText: "Négative rang 2", votedUp: false, rankInGame: 2 }),
  makeReview({ recommendationId: 6, reviewText: "Négative rang 3", votedUp: false, rankInGame: 3 }),
];

describe("ReviewBattle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the top-ranked positive and negative review side by side by default", () => {
    render(<ReviewBattle reviews={reviews} />);
    expect(screen.getByText("Positive rang 1")).toBeInTheDocument();
    expect(screen.getByText("Négative rang 1")).toBeInTheDocument();
    expect(screen.queryByText("Positive rang 2")).not.toBeInTheDocument();
  });

  it("randomizes only the positive side when clicking its dice", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5); // 3 candidats -> index 1
    render(<ReviewBattle reviews={reviews} />);
    const buttons = screen.getAllByRole("button", { name: /autre review/i });
    fireEvent.click(buttons[0]);

    expect(screen.getByText("Positive rang 2")).toBeInTheDocument();
    expect(screen.getByText("Négative rang 1")).toBeInTheDocument();
  });

  it("randomizes only the negative side when clicking its dice", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    render(<ReviewBattle reviews={reviews} />);
    const buttons = screen.getAllByRole("button", { name: /autre review/i });
    fireEvent.click(buttons[1]);

    expect(screen.getByText("Positive rang 1")).toBeInTheDocument();
    expect(screen.getByText("Négative rang 2")).toBeInTheDocument();
  });

  it("randomizes both sides at once", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    render(<ReviewBattle reviews={reviews} />);
    fireEvent.click(screen.getByRole("button", { name: /les deux/i }));

    expect(screen.getByText("Positive rang 2")).toBeInTheDocument();
    expect(screen.getByText("Négative rang 2")).toBeInTheDocument();
  });

  it("disables a side's dice when there is only one candidate on that side", () => {
    render(<ReviewBattle reviews={[reviews[0], reviews[3]]} />);
    const buttons = screen.getAllByRole("button", { name: /autre review/i });
    expect(buttons[0]).toBeDisabled();
    expect(buttons[1]).toBeDisabled();
  });
});
