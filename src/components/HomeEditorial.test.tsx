import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomeEditorial, type HomeData, type PodiumGame } from "@/components/HomeEditorial";

// La nav embarque la recherche typeahead, un client component qui appelle
// `useRouter` : rendue hors App Router, elle a besoin d'un routeur simulé.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function game(appId: number, name: string, pct: number, extra: Partial<PodiumGame> = {}): PodiumGame {
  return { appId, name, coverUrl: null, pct, meta: `${appId} reviews this week`, ...extra };
}

function homeData(overrides: Partial<HomeData> = {}): HomeData {
  return {
    week: {
      label: "best of the week",
      range: "07 Sep – 13 Sep",
      games: [
        game(1, "Winner", 96, { quote: "Best [b]thing[/b] I played all year." }),
        game(2, "Second", 88),
        game(3, "Third", 71),
      ],
    },
    lists: [
      {
        title: "Best of 2026",
        unit: "year to date",
        blurb: "Highest positive share this year.",
        games: [game(10, "Year winner", 97), game(11, "Year second", 93)],
      },
      {
        title: "Nobody agrees",
        unit: "most polarised",
        blurb: "Games whose reviews split hardest.",
        games: [game(20, "Divisive", 50), game(21, "Also divisive", 51)],
      },
    ],
    sentiment: [0.8, 0.81, 0.83],
    volume: [10, 20, 30],
    totals: { reviews: 182_000_000, games: 4_300, languages: 29, weekReviews: 1_200_000, lists: 4 },
    ...overrides,
  };
}

describe("HomeEditorial", () => {
  it("fait du gagnant de la fenêtre le héros de la page", () => {
    render(<HomeEditorial data={homeData()} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Winner");
    expect(screen.getByText("best of the week · 07 Sep – 13 Sep")).toBeInTheDocument();
    expect(screen.getByText("96%")).toBeInTheDocument();
  });

  it("rend le BBCode de la citation plutôt que ses balises", () => {
    const { container } = render(<HomeEditorial data={homeData()} />);

    const quote = container.querySelector("blockquote");
    expect(quote).toHaveTextContent("Best thing I played all year.");
    expect(quote?.querySelector("strong")).toHaveTextContent("thing");
  });

  it("laisse tomber la fenêtre du kicker quand elle est inconnue", () => {
    const data = homeData();
    data.week.range = null;
    render(<HomeEditorial data={data} />);

    expect(screen.getByText("best of the week")).toBeInTheDocument();
  });

  it("numérote les dauphins à partir de 02", () => {
    render(<HomeEditorial data={homeData()} />);

    expect(within(screen.getByRole("link", { name: /Second/ })).getByText("02")).toBeInTheDocument();
    expect(within(screen.getByRole("link", { name: /Third/ })).getByText("03")).toBeInTheDocument();
  });

  it("ne rend ni héros ni podium quand la fenêtre n'a sacré personne", () => {
    const data = homeData();
    data.week.games = [];
    render(<HomeEditorial data={data} />);

    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Runners-up" })).not.toBeInTheDocument();
    // Le reste de la page tient debout : les rubriques ne dépendent pas du héros.
    expect(screen.getByRole("heading", { name: "Two more questions" })).toBeInTheDocument();
  });

  it("mène chaque jeu cité vers sa fiche", () => {
    render(<HomeEditorial data={homeData()} />);

    expect(screen.getByRole("link", { name: "Read the reviews" })).toHaveAttribute("href", "/games/1");
    expect(screen.getByRole("link", { name: /Divisive/ })).toHaveAttribute("href", "/games/20");
  });

  it("annonce le nombre de classements réellement proposés par /charts", () => {
    render(<HomeEditorial data={homeData()} />);

    const doors = screen.getByRole("link", { name: /All lists/ });
    expect(within(doors).getByText("4")).toBeInTheDocument();
  });
});
