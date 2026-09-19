import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomeEditorial, type HomeData, type PodiumGame } from "@/components/HomeEditorial";
import type { AwardSlide } from "@/lib/homeAwards";

// La nav embarque la recherche typeahead, un client component qui appelle
// `useRouter` : rendue hors App Router, elle a besoin d'un routeur simulé.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function game(appId: number, name: string, pct: number): PodiumGame {
  return { appId, name, coverUrl: null, pct, meta: `${appId} reviews in the last 7 days` };
}

function award(id: AwardSlide["id"], appId: number, name: string, extra: Partial<AwardSlide> = {}): AwardSlide {
  return {
    id,
    chip: name,
    label: "best of last 7 days",
    range: "07 Sep – 13 Sep",
    hint: "Highest share of positive reviews written in the last 7 days, among games with at least 100 reviews.",
    appId,
    name,
    coverUrl: null,
    art: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1/library_hero.jpg",
    figure: "96%",
    figureColor: "var(--status-good)",
    meta: "1,234 reviews in the last 7 days",
    layout: "game",
    ...extra,
  };
}

function homeData(overrides: Partial<HomeData> = {}): HomeData {
  return {
    awards: [
      award("best-of-week", 1, "Winner", { chip: "Best of the week", quote: "Best [b]thing[/b] I played all year." }),
      award("best-of-year", 10, "Year winner", { chip: "Best of 2026" }),
      award("nobody-agrees", 20, "Divisive", { chip: "Nobody agrees", figure: "51%", range: null }),
    ],
    runnersUp: [game(2, "Second", 88), game(3, "Third", 71)],
    sentiment: [0.8, 0.81, 0.83],
    volume: [10, 20, 30],
    totals: { reviews: 182_000_000, games: 4_300, languages: 29, weekReviews: 1_200_000, lists: 4 },
    ...overrides,
  };
}

describe("HomeEditorial", () => {
  it("ouvre sur le carrousel, gagnant de la semaine en tête", () => {
    render(<HomeEditorial data={homeData()} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Winner");
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByText("best of last 7 days · 07 Sep – 13 Sep")).toBeInTheDocument();
    expect(within(panel).getByText("96%")).toBeInTheDocument();
  });

  it("donne une puce à chaque récompense, dans l'ordre reçu", () => {
    render(<HomeEditorial data={homeData()} />);

    const tabs = within(screen.getByRole("tablist")).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Best of the week", "Best of 2026", "Nobody agrees"]);
  });

  it("ne garde plus la rubrique « Two more questions », passée dans le carrousel", () => {
    render(<HomeEditorial data={homeData()} />);

    expect(screen.queryByRole("heading", { name: "Two more questions" })).not.toBeInTheDocument();
  });

  it("numérote les dauphins à partir de 02", () => {
    render(<HomeEditorial data={homeData()} />);

    expect(within(screen.getByRole("link", { name: /Second/ })).getByText("02")).toBeInTheDocument();
    expect(within(screen.getByRole("link", { name: /Third/ })).getByText("03")).toBeInTheDocument();
  });

  it("tient debout sans aucune récompense ni dauphin", () => {
    render(<HomeEditorial data={homeData({ awards: [], runnersUp: [] })} />);

    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Runners-up" })).not.toBeInTheDocument();
    // Le reste de la page ne dépend pas du carrousel.
    expect(screen.getByRole("heading", { name: "Dig deeper" })).toBeInTheDocument();
  });

  it("explique la règle de la récompense affichée dans la bulle du kicker", () => {
    const data = homeData();
    render(<HomeEditorial data={data} />);

    expect(screen.getByRole("button", { name: data.awards[0].hint })).toBeInTheDocument();
  });

  it("annonce la taille du corpus avant tout le reste", () => {
    render(<HomeEditorial data={homeData()} />);

    const count = screen.getByText("182,000,000");
    expect(screen.getByText(/steam reviews collected · 4,300 games · 29 languages/)).toBeInTheDocument();
    // Avant le carrousel : c'est la première chose que le lecteur lit de la page.
    const title = screen.getByRole("heading", { level: 1 });
    expect(count.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("mène la récompense affichée et chaque dauphin vers leur fiche", () => {
    render(<HomeEditorial data={homeData()} />);

    expect(screen.getByRole("link", { name: "Read the reviews" })).toHaveAttribute("href", "/games/1");
    expect(screen.getByRole("link", { name: /Second/ })).toHaveAttribute("href", "/games/2");
  });

  it("annonce le nombre de classements réellement proposés par /charts", () => {
    render(<HomeEditorial data={homeData()} />);

    const doors = screen.getByRole("link", { name: /All lists/ });
    expect(within(doors).getByText("4")).toBeInTheDocument();
  });
});
