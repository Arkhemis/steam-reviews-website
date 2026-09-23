import { render, screen } from "@testing-library/react";
import { isValidElement, Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GamePage, { generateMetadata } from "@/app/games/[appId]/page";
import {
  CoverageBand,
  DlcSection,
  LanguagesSection,
  ReviewsSection,
  SummarySection,
  TrendsSection,
  VolumeSection,
} from "@/app/games/[appId]/sections";
import {
  BALDURS_GATE_3_APP_ID,
  baldursGate3LanguageDistribution,
  baldursGate3ReviewTrends,
} from "@/lib/data/fixtures/baldursGate3";
import type { GameProfile, GameTopReview } from "@/lib/data/types";

// La page tape Postgres ; comme pour la carte, on mocke la couche data pour
// tester le rendu (et le découpage en boundaries Suspense) sans base locale.
// Le SQL lui-même reste couvert par gameData.test.ts.
const {
  getGameStats,
  getGameCoverage,
  getGameDailyTrend,
  getGameDlcs,
  getGameEvents,
  getGameReviewTrends,
  getGameLanguageDistribution,
  getGameReviewLanguages,
  getGameReviewSummary,
  getGameTopReviews,
} = vi.hoisted(() => ({
  getGameDlcs: vi.fn(),
  getGameStats: vi.fn(),
  getGameCoverage: vi.fn(),
  getGameDailyTrend: vi.fn(),
  getGameEvents: vi.fn(),
  getGameReviewTrends: vi.fn(),
  getGameLanguageDistribution: vi.fn(),
  getGameReviewLanguages: vi.fn(),
  getGameReviewSummary: vi.fn(),
  getGameTopReviews: vi.fn(),
}));

vi.mock("@/lib/data/gameData", () => ({
  getGameStats,
  getGameCoverage,
  getGameDailyTrend,
  getGameDlcs,
  getGameEvents,
  getGameReviewTrends,
  getGameLanguageDistribution,
  getGameReviewLanguages,
  getGameReviewSummary,
  getGameTopReviews,
  TOP_REVIEWS_PER_SIDE: 20,
}));

// Le héros tâte le CDN de Steam pour son illustration : sans ce mock, rendre la
// page partirait sur le réseau.
vi.mock("@/lib/steamArtwork", () => ({ resolveSteamHeroArt: vi.fn().mockResolvedValue(null) }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const game: GameProfile = {
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
  store: {
    appType: "game",
    priceUsd: 59.99,
    isFree: false,
    isEarlyAccess: false,
    isComingSoon: false,
    isAvailable: true,
    parentGame: null,
  },
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

  describe("store listing", () => {
    async function renderWithStore(store: GameProfile["store"]) {
      getGameStats.mockResolvedValue({ ...game, store });
      render(
        await GamePage({
          params: Promise.resolve({ appId: String(BALDURS_GATE_3_APP_ID) }),
          searchParams: Promise.resolve({}),
        }),
      );
    }

    it("shows the base price, and no type badge for a plain game", async () => {
      await renderWithStore(game.store);

      expect(screen.getByText("$59.99")).toBeInTheDocument();
      expect(screen.queryByText("Game")).not.toBeInTheDocument();
    });

    it("flags a free early-access DLC that has not shipped yet", async () => {
      await renderWithStore({
        appType: "dlc",
        priceUsd: null,
        isFree: true,
        isEarlyAccess: true,
        isComingSoon: true,
        isAvailable: true,
        parentGame: null,
      });

      for (const label of ["Free", "DLC", "Coming soon", "Early Access"]) {
        expect(screen.getByText(label)).toBeInTheDocument();
      }
    });

    // Steam renvoie une fiche vide pour une app retirée : son prix et son type
    // n'existent plus, seul le retrait se dit.
    it("only says the app was removed when it left the store", async () => {
      await renderWithStore({
        appType: "other",
        priceUsd: null,
        isFree: false,
        isEarlyAccess: false,
        isComingSoon: false,
        isAvailable: false,
        parentGame: null,
      });

      expect(screen.getByLabelText("Steam store listing")).toHaveTextContent(/^Removed from Steam$/);
    });

    it("links a DLC back to the game it extends", async () => {
      await renderWithStore({
        ...game.store!,
        appType: "dlc",
        parentGame: { appId: 292030, name: "The Witcher 3: Wild Hunt" },
      });

      expect(screen.getByRole("link", { name: /The Witcher 3: Wild Hunt/ })).toHaveAttribute("href", "/games/292030");
    });

    // Blood and Wine n'a plus d'offre d'achat : il ne s'obtient qu'avec la
    // Complete Edition. Pas de prix, mais pas « gratuit » non plus.
    it("says a DLC with no purchase option is not sold separately", async () => {
      await renderWithStore({
        ...game.store!,
        appType: "dlc",
        priceUsd: null,
        isFree: false,
      });

      expect(screen.getByText("Not sold separately")).toBeInTheDocument();
    });

    // Un DLC annoncé n'a pas encore de prix : il sera vendu, simplement pas encore.
    it("does not call an upcoming DLC unsold", async () => {
      await renderWithStore({
        ...game.store!,
        appType: "dlc",
        priceUsd: null,
        isFree: false,
        isComingSoon: true,
      });

      expect(screen.queryByText("Not sold separately")).not.toBeInTheDocument();
    });

    // Steam compte le temps de jeu sur le jeu de base : un DLC affiche toujours 0.
    it("does not show a 0h median playtime for a DLC", async () => {
      await renderWithStore({ ...game.store!, appType: "dlc" });

      expect(screen.queryByText("0h")).not.toBeInTheDocument();
      expect(screen.queryByText("100h")).not.toBeInTheDocument();
      expect(screen.getByText("Steam doesn't track DLC playtime")).toBeInTheDocument();
    });

    it("renders no store row when Steam has not been asked yet", async () => {
      await renderWithStore(null);

      expect(screen.queryByLabelText("Steam store listing")).not.toBeInTheDocument();
    });
  });

  // La section DLC a sa propre boundary : la page ne l'attend pas.
  it("streams the DLC list instead of awaiting it", async () => {
    const jsx = await GamePage({
      params: Promise.resolve({ appId: String(BALDURS_GATE_3_APP_ID) }),
      searchParams: Promise.resolve({}),
    });

    expect(getGameDlcs).not.toHaveBeenCalled();
    expect(findElement(jsx, DlcSection)?.props).toMatchObject({ appId: BALDURS_GATE_3_APP_ID });
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

    expect(await screen.findByRole("img", { name: /positive score over time/ })).toBeInTheDocument();
  });

  it("renders the language breakdown once the section resolves", async () => {
    render(<Suspense fallback={null}>{await LanguagesSection({ appId: BALDURS_GATE_3_APP_ID })}</Suspense>);

    expect(await screen.findByRole("group", { name: /^English:/ })).toBeInTheDocument();
  });
});

describe("SummarySection", () => {
  it("disparaît pour un jeu sans résumé", async () => {
    getGameReviewSummary.mockResolvedValue(null);

    expect(await SummarySection({ appId: 292030 })).toBeNull();
  });

  it("montre le paragraphe, puis les points pour et contre face à face", async () => {
    getGameReviewSummary.mockResolvedValue({
      summary: "Players love the story but not Act 3.",
      pros: ["Deep story", "Great companions"],
      cons: ["Act 3 bugs"],
      model: "qwen3:8b",
      reviewsUsed: 60,
      generatedOn: "2026-09-21",
    });

    render(await SummarySection({ appId: BALDURS_GATE_3_APP_ID }));

    expect(screen.getByText("Players love the story but not Act 3.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "In a nutshell…" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pros" }).nextElementSibling?.textContent).toContain("Great companions");
    expect(screen.getByRole("heading", { name: "Cons" }).nextElementSibling?.textContent).toContain("Act 3 bugs");
    // Le modèle et la méthode sont dans la bulle d'aide, pas dans le texte.
    expect(screen.getByRole("button", { name: /qwen3:8b.*60 reviews.*Sep 21, 2026/ })).toBeInTheDocument();
  });
});

describe("DlcSection", () => {
  const dlc = {
    appId: 378648,
    name: "Blood and Wine",
    coverUrl: null,
    pctPositive: 0.97,
    totalReviews: 10255,
    priceUsd: 19.99,
    isFree: false,
  };

  it("renders nothing for a game without DLC", async () => {
    getGameDlcs.mockResolvedValue({ dlcs: [], total: 0 });

    expect(await DlcSection({ appId: 292030 })).toBeNull();
  });

  it("links each DLC to its own page, with its score and price", async () => {
    getGameDlcs.mockResolvedValue({ dlcs: [dlc], total: 1 });
    render(await DlcSection({ appId: 292030 }));

    expect(screen.getByRole("link", { name: /Blood and Wine/ })).toHaveAttribute("href", "/games/378648");
    expect(screen.getByText("97%")).toBeInTheDocument();
    expect(screen.getByText("$19.99")).toBeInTheDocument();
    expect(screen.queryByText(/on Steam ↗/)).not.toBeInTheDocument();
  });

  // Un DLC que Steam n'a pas encore noté n'a pas de score : pas de 0 % trompeur.
  it("says a DLC has no reviews rather than scoring it 0%", async () => {
    getGameDlcs.mockResolvedValue({ dlcs: [{ ...dlc, pctPositive: null, totalReviews: 0 }], total: 1 });
    render(await DlcSection({ appId: 292030 }));

    expect(screen.getByText("no reviews")).toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });

  it("points to the Steam DLC page when it only shows part of the list", async () => {
    getGameDlcs.mockResolvedValue({ dlcs: [dlc], total: 31 });
    render(await DlcSection({ appId: 24010 }));

    expect(screen.getByRole("link", { name: /all 31 on Steam/ })).toHaveAttribute(
      "href",
      "https://store.steampowered.com/dlc/24010/",
    );
  });
});

describe("generateMetadata", () => {
  const props = {
    params: Promise.resolve({ appId: String(BALDURS_GATE_3_APP_ID) }),
    searchParams: Promise.resolve({ lang: "french" }),
  };

  it("nomme le jeu dans le titre et met les chiffres de la fiche dans la description", async () => {
    getGameStats.mockResolvedValue(game);
    const metadata = await generateMetadata(props);

    expect(metadata.title).toBe("Baldur's Gate III Steam reviews: score, trends & playtime");
    expect(metadata.description).toContain("rated Overwhelmingly Positive on Steam: 97% of 87,000 reviews");
    expect(metadata.description).toContain("Median playtime 100h.");
  });

  it("pointe la canonique sur la fiche sans ?lang= et prend la jaquette pour l'aperçu", async () => {
    getGameStats.mockResolvedValue(game);
    const metadata = await generateMetadata(props);

    expect(metadata.alternates?.canonical).toBe(`/games/${BALDURS_GATE_3_APP_ID}`);
    expect(metadata.openGraph?.images).toEqual([{ url: game.coverUrl, alt: "Baldur's Gate III cover" }]);
  });

  it("tait le temps de jeu d'un DLC, que Steam ne compte pas", async () => {
    getGameStats.mockResolvedValue({ ...game, store: { ...game.store!, appType: "dlc" } });
    const metadata = await generateMetadata(props);

    expect(metadata.description).not.toContain("playtime");
  });

  it("demande de ne pas indexer un jeu inconnu", async () => {
    getGameStats.mockResolvedValue(null);
    const metadata = await generateMetadata(props);

    expect(metadata.robots).toEqual({ index: false });
  });
});
