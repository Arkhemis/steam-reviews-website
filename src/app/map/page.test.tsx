import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MapPage from "@/app/map/page";
import type { GameStats, LanguageReviewScore } from "@/lib/data/types";
import { FALLBACK_COLOR, scoreToColor } from "@/lib/map";

// La page tape Postgres ; on mocke la couche data pour tester le branchement
// du filtre (quelle requête, quelles couleurs) sans base locale.
const { getGameStats, getGameLanguageReviewScores, getLanguageReviewScores } = vi.hoisted(() => ({
  getGameStats: vi.fn(),
  getGameLanguageReviewScores: vi.fn(),
  getLanguageReviewScores: vi.fn(),
}));

vi.mock("@/lib/data/gameData", () => ({
  getGameStats,
  getGameLanguageReviewScores,
  getLanguageReviewScores,
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const game: GameStats = {
  appId: 1086940,
  name: "Baldur's Gate III",
  genres: [],
  developers: [],
  publishers: [],
  coverUrl: null,
  firstReleaseDate: null,
  totalReviews: 87000,
  reviewScore: 9,
  pctPositive: 0.96,
  playtimeMedianMinutes: 6000,
  pctSteamDeck: 0.1,
  pctRefunded: 0.02,
};

function score(language: string, totalReviews: number, pctPositive: number): LanguageReviewScore {
  return {
    language,
    totalReviews,
    totalPositive: Math.round(totalReviews * pctPositive),
    pctPositive,
    pctOfTotal: 0.5,
  };
}

// getByTitle ne voit que les <title> enfants directs d'un <svg> ; ceux de la
// carte sont dans les <path>, donc on les lit à la main.
function countryPath(container: HTMLElement, name: string): SVGPathElement | undefined {
  const title = Array.from(container.querySelectorAll("svg title")).find((node) =>
    node.textContent?.startsWith(`${name} —`),
  );
  return title?.parentElement as SVGPathElement | undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  getLanguageReviewScores.mockResolvedValue([score("english", 900000, 0.85)]);
  getGameStats.mockResolvedValue(game);
  getGameLanguageReviewScores.mockResolvedValue([score("english", 45000, 0.94), score("french", 3, 0)]);
});

describe("MapPage", () => {
  it("shows the global scores when no game is selected", async () => {
    render(await MapPage({ searchParams: Promise.resolve({}) }));

    expect(getLanguageReviewScores).toHaveBeenCalled();
    expect(getGameLanguageReviewScores).not.toHaveBeenCalled();
    expect(screen.getByText(/every Steam language/)).toBeInTheDocument();
  });

  it("switches to the game's own scores when one is selected", async () => {
    const { container } = render(await MapPage({ searchParams: Promise.resolve({ app: "1086940" }) }));

    expect(getGameLanguageReviewScores).toHaveBeenCalledWith(1086940);
    expect(getLanguageReviewScores).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: /Baldur's Gate III/ })).toBeInTheDocument();

    const usa = countryPath(container, "United States of America");
    expect(usa?.textContent).toContain("94% positive");
    expect(usa?.getAttribute("fill")).toBe(scoreToColor(0.94));
  });

  it("leaves a language with too few reviews uncolored on the map", async () => {
    const { container } = render(await MapPage({ searchParams: Promise.resolve({ app: "1086940" }) }));

    // La France suit le français, qui n'a que 3 avis sur ce jeu.
    const france = countryPath(container, "France");
    expect(france?.textContent).toBe("France — unrated");
    expect(france?.getAttribute("fill")).toBe(FALLBACK_COLOR);
  });

  it("falls back to the global map for an unknown app id", async () => {
    getGameStats.mockResolvedValue(null);
    render(await MapPage({ searchParams: Promise.resolve({ app: "999999999" }) }));

    expect(getLanguageReviewScores).toHaveBeenCalled();
    expect(screen.getByText(/Game not found/)).toBeInTheDocument();
  });

  it("ignores a non-numeric app id without querying the game", async () => {
    render(await MapPage({ searchParams: Promise.resolve({ app: "1086940; DROP TABLE" }) }));

    expect(getGameStats).not.toHaveBeenCalled();
    expect(getLanguageReviewScores).toHaveBeenCalled();
  });
});
