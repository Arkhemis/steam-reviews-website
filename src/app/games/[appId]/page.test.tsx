import { render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GamePage from "@/app/games/[appId]/page";
import { LanguagesSection, ReviewsSection, TrendsSection } from "@/app/games/[appId]/sections";
import {
  BALDURS_GATE_3_APP_ID,
  baldursGate3LanguageDistribution,
  baldursGate3ReviewTrends,
} from "@/lib/data/fixtures/baldursGate3";
import type { GameStats, GameTopReview } from "@/lib/data/types";

// La page tape Postgres ; comme pour la carte, on mocke la couche data pour
// tester le rendu (et le découpage en boundaries Suspense) sans base locale.
// Le SQL lui-même reste couvert par gameData.test.ts.
const { getGameStats, getGameReviewTrends, getGameLanguageDistribution, getGameTopReviews } = vi.hoisted(
  () => ({
    getGameStats: vi.fn(),
    getGameReviewTrends: vi.fn(),
    getGameLanguageDistribution: vi.fn(),
    getGameTopReviews: vi.fn(),
  }),
);

vi.mock("@/lib/data/gameData", () => ({
  getGameStats,
  getGameReviewTrends,
  getGameLanguageDistribution,
  getGameTopReviews,
  TOP_REVIEWS_PER_SIDE: 20,
}));

const game: GameStats = {
  appId: BALDURS_GATE_3_APP_ID,
  name: "Baldur's Gate III",
  genres: ["RPG"],
  developers: ["Larian Studios"],
  publishers: ["Larian Studios"],
  coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co670h.jpg",
  firstReleaseDate: "2023-08-03",
  totalReviews: 87000,
  reviewScore: 9,
  pctPositive: 0.97,
  playtimeMedianMinutes: 6000,
  pctSteamDeck: 0.1,
  pctRefunded: 0.02,
};

function review(overrides: Partial<GameTopReview>): GameTopReview {
  return {
    recommendationId: 1,
    appId: BALDURS_GATE_3_APP_ID,
    reviewText: "Superbe jeu, rien à redire",
    language: "french",
    votedUp: true,
    votesUp: 1200,
    votesFunny: 3,
    weightedVoteScore: 0.9,
    authorPersonaname: "Astarion",
    authorAvatarUrl: "https://avatars.steamstatic.com/abc_full.jpg",
    authorPlaytimeAtReviewMinutes: 6000,
    authorLastPlayedAt: null,
    reviewUrl: "https://steamcommunity.com/id/x/recommended/1086940",
    rankInGame: 1,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getGameStats.mockResolvedValue(game);
  getGameReviewTrends.mockResolvedValue(baldursGate3ReviewTrends);
  getGameLanguageDistribution.mockResolvedValue(baldursGate3LanguageDistribution);
  getGameTopReviews.mockResolvedValue([
    review({}),
    review({ recommendationId: 2, votedUp: false, reviewText: "Trop de bugs au patch 4" }),
  ]);
});

describe("GamePage", () => {
  it("renders the header and KPIs without awaiting the section queries", async () => {
    const jsx = await GamePage({ params: Promise.resolve({ appId: String(BALDURS_GATE_3_APP_ID) }) });

    // Le shell ne dépend que de getGameStats : quand la page rend, les trois
    // requêtes lourdes n'ont pas encore été lancées — elles vivent dans leurs
    // propres boundaries et partent au fur et à mesure du stream.
    expect(getGameStats).toHaveBeenCalledWith(BALDURS_GATE_3_APP_ID);
    expect(getGameTopReviews).not.toHaveBeenCalled();
    expect(getGameReviewTrends).not.toHaveBeenCalled();

    render(jsx);
    expect(screen.getByText("Baldur's Gate III")).toBeInTheDocument();
    expect(screen.getByText("97%")).toBeInTheDocument();
  });

  it("renders a not-found message for an unknown app id", async () => {
    getGameStats.mockResolvedValue(null);
    render(await GamePage({ params: Promise.resolve({ appId: "999999999" }) }));

    expect(screen.getByText(/introuvable/i)).toBeInTheDocument();
  });
});

describe("GamePage sections", () => {
  it("renders the reviews once the section resolves", async () => {
    render(<Suspense fallback={null}>{await ReviewsSection({ appId: BALDURS_GATE_3_APP_ID })}</Suspense>);

    expect(await screen.findByText(/Superbe jeu, rien à redire/)).toBeInTheDocument();
    expect(screen.getByText(/Trop de bugs au patch 4/)).toBeInTheDocument();
  });

  it("renders the score chart once the section resolves", async () => {
    render(<Suspense fallback={null}>{await TrendsSection({ appId: BALDURS_GATE_3_APP_ID })}</Suspense>);

    expect(await screen.findByRole("img", { name: /Évolution du score positif/ })).toBeInTheDocument();
  });

  it("renders the language breakdown once the section resolves", async () => {
    render(<Suspense fallback={null}>{await LanguagesSection({ appId: BALDURS_GATE_3_APP_ID })}</Suspense>);

    expect(await screen.findByRole("group", { name: /^english:/ })).toBeInTheDocument();
  });
});
