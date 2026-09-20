import { render, screen } from "@testing-library/react";
import { isValidElement, Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GamePage from "@/app/games/[appId]/page";
import {
  CoverageBand,
  LanguagesSection,
  ReviewsSection,
  TrendsSection,
  VolumeSection,
} from "@/app/games/[appId]/sections";
import {
  BALDURS_GATE_3_APP_ID,
  baldursGate3LanguageDistribution,
  baldursGate3ReviewTrends,
} from "@/lib/data/fixtures/baldursGate3";
import type { GameStats, GameTopReview } from "@/lib/data/types";

// La page tape Postgres ; comme pour la carte, on mocke la couche data pour
// tester le rendu (et le découpage en boundaries Suspense) sans base locale.
// Le SQL lui-même reste couvert par gameData.test.ts.
const {
  getGameStats,
  getGameCoverage,
  getGameDailyTrend,
  getGameEvents,
  getGameReviewTrends,
  getGameLanguageDistribution,
  getGameReviewLanguages,
  getGameTopReviews,
} = vi.hoisted(() => ({
  getGameStats: vi.fn(),
  getGameCoverage: vi.fn(),
  getGameDailyTrend: vi.fn(),
  getGameEvents: vi.fn(),
  getGameReviewTrends: vi.fn(),
  getGameLanguageDistribution: vi.fn(),
  getGameReviewLanguages: vi.fn(),
  getGameTopReviews: vi.fn(),
}));

vi.mock("@/lib/data/gameData", () => ({
  getGameStats,
  getGameCoverage,
  getGameDailyTrend,
  getGameEvents,
  getGameReviewTrends,
  getGameLanguageDistribution,
  getGameReviewLanguages,
  getGameTopReviews,
  TOP_REVIEWS_PER_SIDE: 20,
}));

// Le héros tâte le CDN de Steam pour son illustration : sans ce mock, rendre la
// page partirait sur le réseau.
vi.mock("@/lib/steamArtwork", () => ({ resolveSteamHeroArt: vi.fn().mockResolvedValue(null) }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

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
    createdAt: "2023-01-15T00:00:00.000Z",
    reviewUrl: "https://steamcommunity.com/id/x/recommended/1086940",
    rankInGame: 1,
    ...overrides,
  };
}

/** Retrouve dans l'arbre rendu le premier élément d'un type de composant donné. */
function findElement(node: unknown, type: unknown): { key: string | null; props: Record<string, unknown> } | null {
  if (!isValidElement(node)) {
    return Array.isArray(node)
      ? node.reduce<ReturnType<typeof findElement>>((found, child) => found ?? findElement(child, type), null)
      : null;
  }
  if (node.type === type) return node as never;
  return findElement((node.props as { children?: unknown }).children, type);
}

/** Clé du <Suspense> qui enveloppe un composant donné. */
function findSuspenseKeyAround(node: unknown, type: unknown): string | null | undefined {
  if (!isValidElement(node)) {
    return Array.isArray(node)
      ? node.reduce<string | null | undefined>((found, child) => found ?? findSuspenseKeyAround(child, type), undefined)
      : undefined;
  }
  if (node.type === Suspense && findElement((node.props as { children?: unknown }).children, type)) {
    return node.key;
  }
  return findSuspenseKeyAround((node.props as { children?: unknown }).children, type);
}

beforeEach(() => {
  vi.clearAllMocks();
  getGameStats.mockResolvedValue(game);
  getGameCoverage.mockResolvedValue({ loadedReviews: 62000, languageCount: 10, latestReviewOn: "2024-07-31" });
  getGameDailyTrend.mockResolvedValue([{ date: "2024-07-31", reviews: 120, positive: 110 }]);
  getGameReviewTrends.mockResolvedValue(baldursGate3ReviewTrends);
  getGameEvents.mockResolvedValue([]);
  getGameLanguageDistribution.mockResolvedValue(baldursGate3LanguageDistribution);
  getGameReviewLanguages.mockResolvedValue([
    { language: "english", reviewCount: 30 },
    { language: "french", reviewCount: 12 },
  ]);
  getGameTopReviews.mockResolvedValue([
    review({}),
    review({ recommendationId: 2, votedUp: false, reviewText: "Trop de bugs au patch 4" }),
  ]);
});

describe("GamePage", () => {
  it("renders the header and KPIs without awaiting the section queries", async () => {
    const jsx = await GamePage({
      params: Promise.resolve({ appId: String(BALDURS_GATE_3_APP_ID) }),
      searchParams: Promise.resolve({}),
    });

    // Le shell ne dépend que de getGameStats : quand la page rend, les trois
    // requêtes lourdes n'ont pas encore été lancées — elles vivent dans leurs
    // propres boundaries et partent au fur et à mesure du stream.
    expect(getGameStats).toHaveBeenCalledWith(BALDURS_GATE_3_APP_ID);
    expect(getGameTopReviews).not.toHaveBeenCalled();
    expect(getGameReviewTrends).not.toHaveBeenCalled();
    expect(getGameCoverage).not.toHaveBeenCalled();

    render(jsx);
    expect(screen.getByText("Baldur's Gate III")).toBeInTheDocument();
    expect(screen.getByText("97%")).toBeInTheDocument();
    expect(screen.getByText(/overwhelmingly positive/i)).toBeInTheDocument();
  });

  // Le héros annonce ce que Steam compte, pas ce que le site a chargé : le
  // bandeau juste au-dessus dit l'autre chiffre, et les deux diffèrent.
  it("credits Steam for the review count it shows in the hero", async () => {
    const jsx = await GamePage({
      params: Promise.resolve({ appId: String(BALDURS_GATE_3_APP_ID) }),
      searchParams: Promise.resolve({}),
    });

    render(jsx);
    expect(screen.getByText(/87,000 reviews on Steam/)).toBeInTheDocument();
  });

  it("hands the requested language to the reviews section", async () => {
    const jsx = await GamePage({
      params: Promise.resolve({ appId: String(BALDURS_GATE_3_APP_ID) }),
      searchParams: Promise.resolve({ lang: "french" }),
    });

    const section = findElement(jsx, ReviewsSection);
    expect(section?.props).toMatchObject({ appId: BALDURS_GATE_3_APP_ID, lang: "french" });
  });

  it("remounts the reviews boundary when the language changes, so the skeleton comes back", async () => {
    const french = await GamePage({
      params: Promise.resolve({ appId: String(BALDURS_GATE_3_APP_ID) }),
      searchParams: Promise.resolve({ lang: "french" }),
    });
    const german = await GamePage({
      params: Promise.resolve({ appId: String(BALDURS_GATE_3_APP_ID) }),
      searchParams: Promise.resolve({ lang: "german" }),
    });

    expect(findSuspenseKeyAround(french, ReviewsSection)).not.toBe(
      findSuspenseKeyAround(german, ReviewsSection),
    );
  });

  it("renders a not-found message for an unknown app id", async () => {
    getGameStats.mockResolvedValue(null);
    render(await GamePage({ params: Promise.resolve({ appId: "999999999" }), searchParams: Promise.resolve({}) }));

    expect(screen.getByText(/was not found/i)).toBeInTheDocument();
  });
});

describe("GamePage sections", () => {
  // Le compteur du bandeau lit le mart quotidien, pas `game_stats` : il compte
  // les avis réellement en base, là où le héros affiche le total de Steam.
  it("annonce ce que le site a vraiment chargé du jeu", async () => {
    render(<Suspense fallback={null}>{await CoverageBand({ appId: BALDURS_GATE_3_APP_ID })}</Suspense>);

    expect(await screen.findByText("62,000")).toBeInTheDocument();
    expect(screen.getByText(/reviews analyzed · 10 languages · latest one Jul 31, 2024/)).toBeInTheDocument();
  });

  it("dessine une barre par jour de la fenêtre, trous compris", async () => {
    getGameDailyTrend.mockResolvedValue([
      { date: "2024-07-29", reviews: 10, positive: 9 },
      { date: "2024-07-31", reviews: 20, positive: 18 },
    ]);

    render(<Suspense fallback={null}>{await VolumeSection({ appId: BALDURS_GATE_3_APP_ID })}</Suspense>);

    const bars = await screen.findByRole("img", { name: /Reviews per day/ });
    expect(bars.children).toHaveLength(31);
    expect(getGameDailyTrend).toHaveBeenCalledWith(BALDURS_GATE_3_APP_ID, 31);
  });

  it("renders the reviews once the section resolves", async () => {
    render(<Suspense fallback={null}>{await ReviewsSection({ appId: BALDURS_GATE_3_APP_ID })}</Suspense>);

    expect(await screen.findByText(/Superbe jeu, rien à redire/)).toBeInTheDocument();
    expect(screen.getByText(/Trop de bugs au patch 4/)).toBeInTheDocument();
  });

  it("loads english reviews when the visitor asked for no particular language", async () => {
    await ReviewsSection({ appId: BALDURS_GATE_3_APP_ID });

    expect(getGameTopReviews).toHaveBeenCalledWith(BALDURS_GATE_3_APP_ID, { language: "english" });
  });

  it("loads reviews in the language taken from the URL", async () => {
    await ReviewsSection({ appId: BALDURS_GATE_3_APP_ID, lang: "french" });

    expect(getGameTopReviews).toHaveBeenCalledWith(BALDURS_GATE_3_APP_ID, { language: "french" });
  });

  it("drops the language filter for the all-languages selection", async () => {
    await ReviewsSection({ appId: BALDURS_GATE_3_APP_ID, lang: "all" });

    expect(getGameTopReviews).toHaveBeenCalledWith(BALDURS_GATE_3_APP_ID, { language: null });
  });

  it("offers the game's languages in the selector, with the applied one preselected", async () => {
    render(
      <Suspense fallback={null}>
        {await ReviewsSection({ appId: BALDURS_GATE_3_APP_ID, lang: "french" })}
      </Suspense>,
    );

    expect(await screen.findByRole("combobox")).toHaveValue("french");
    expect(screen.getByRole("option", { name: /English \(30\)/ })).toBeInTheDocument();
  });

  it("renders the score chart once the section resolves", async () => {
    render(<Suspense fallback={null}>{await TrendsSection({ appId: BALDURS_GATE_3_APP_ID })}</Suspense>);

    expect(await screen.findByRole("img", { name: /Positive score over time/ })).toBeInTheDocument();
  });

  it("renders the language breakdown once the section resolves", async () => {
    render(<Suspense fallback={null}>{await LanguagesSection({ appId: BALDURS_GATE_3_APP_ID })}</Suspense>);

    expect(await screen.findByRole("group", { name: /^English:/ })).toBeInTheDocument();
  });
});
