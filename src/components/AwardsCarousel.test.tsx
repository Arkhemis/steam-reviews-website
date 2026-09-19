import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTOPLAY_MS, AwardsCarousel } from "@/components/AwardsCarousel";
import type { AwardSlide } from "@/lib/homeAwards";

function slide(id: AwardSlide["id"], name: string, extra: Partial<AwardSlide> = {}): AwardSlide {
  return {
    id,
    chip: `Chip ${name}`,
    label: `label ${name}`,
    range: "07 Sep – 13 Sep",
    hint: `Hint for ${name}.`,
    appId: name.length,
    name,
    coverUrl: null,
    art: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${name}/library_hero.jpg`,
    figure: "96%",
    figureColor: "var(--status-good)",
    meta: `meta ${name}`,
    layout: "game",
    ...extra,
  };
}

const SLIDES: AwardSlide[] = [
  slide("best-of-week", "Winner", { quote: "Best [b]thing[/b] I played all year." }),
  slide("comeback", "Riser", { figure: "+18 pts", meta: "62% → 80%" }),
  slide("funniest-review", "Joke game", {
    layout: "review",
    quote: "I came for the plot, stayed for the goose.",
    figure: "42",
    figureLabel: "found it funny",
    meta: "by goosefan · 13 hrs at review",
  }),
];

// jsdom n'implémente pas `matchMedia` : on le simule, préférence de mouvement
// comprise, pour chaque test.
function mockReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function setPageHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event("visibilitychange"));
}

function selectedTab() {
  return screen.getByRole("tab", { selected: true });
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  mockReducedMotion(false);
  setPageHidden(false);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AwardsCarousel", () => {
  it("rend une puce par récompense, en onglets", () => {
    render(<AwardsCarousel slides={SLIDES} />);

    const tabs = within(screen.getByRole("tablist")).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Chip Winner", "Chip Riser", "Chip Joke game"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");
  });

  it("relie chaque onglet à sa diapositive", () => {
    render(<AwardsCarousel slides={SLIDES} />);

    const tab = screen.getAllByRole("tab")[0];
    const panel = screen.getByRole("tabpanel");
    expect(tab).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", tab.id);
  });

  it("montre la première diapositive au premier rendu et cache les autres", () => {
    const { container } = render(<AwardsCarousel slides={SLIDES} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Winner");
    const panels = container.querySelectorAll('[role="tabpanel"]');
    expect(panels).toHaveLength(3);
    expect(panels[1]).toHaveAttribute("aria-hidden", "true");
    expect(panels[1]).toHaveAttribute("inert");
    // Un seul panneau exposé : le reste n'est que du texte en réserve.
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
  });

  it("ne donne le titre de page qu'à la première diapositive", () => {
    render(<AwardsCarousel slides={SLIDES} />);

    fireEvent.click(screen.getByRole("tab", { name: "Chip Riser" }));
    expect(screen.getByRole("heading", { level: 2, name: "Riser" })).toBeInTheDocument();
  });

  it("ne précharge que l'illustration de la première diapositive", () => {
    const { container } = render(<AwardsCarousel slides={SLIDES} />);

    const first = container.querySelector('img[src*="Winner"]');
    expect(first).toBeInTheDocument();
    expect(first).not.toHaveAttribute("loading", "lazy");
    // La suivante arrive en lazy, pour que le carrousel n'ait pas de trou à
    // la bascule ; celle d'après n'est même pas dans le DOM.
    expect(container.querySelector('img[src*="Riser"]')).toHaveAttribute("loading", "lazy");
    expect(container.querySelector('img[src*="Joke"]')).not.toBeInTheDocument();
  });

  it("retombe sur la jaquette floutée, en retina, quand Steam n'a pas d'illustration", () => {
    const cover = "https://images.igdb.com/igdb/image/upload/t_cover_big/co670h.jpg";
    const { container } = render(<AwardsCarousel slides={[slide("best-of-week", "Winner", { art: null, coverUrl: cover })]} />);

    const img = [...container.querySelectorAll("img")].find((el) => el.src.includes("co670h"));
    expect(img?.src).toContain("t_cover_big_2x");
    expect(img).toHaveClass("blur-3xl");
  });

  it("affiche la diapositive d'une puce cliquée", () => {
    render(<AwardsCarousel slides={SLIDES} />);

    fireEvent.click(screen.getByRole("tab", { name: "Chip Riser" }));

    expect(selectedTab()).toHaveTextContent("Chip Riser");
    expect(within(screen.getByRole("tabpanel")).getByText("+18 pts")).toBeInTheDocument();
  });

  it("navigue entre les puces aux flèches, Début et Fin", () => {
    render(<AwardsCarousel slides={SLIDES} />);
    const tabs = screen.getAllByRole("tab");

    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expect(selectedTab()).toHaveTextContent("Chip Riser");
    expect(document.activeElement).toBe(tabs[1]);

    fireEvent.keyDown(tabs[1], { key: "End" });
    expect(selectedTab()).toHaveTextContent("Chip Joke game");

    fireEvent.keyDown(tabs[2], { key: "ArrowRight" });
    expect(selectedTab()).toHaveTextContent("Chip Winner");

    fireEvent.keyDown(tabs[0], { key: "ArrowLeft" });
    expect(selectedTab()).toHaveTextContent("Chip Joke game");

    fireEvent.keyDown(tabs[2], { key: "Home" });
    expect(selectedTab()).toHaveTextContent("Chip Winner");
  });

  it("ne laisse qu'une puce dans l'ordre de tabulation", () => {
    render(<AwardsCarousel slides={SLIDES} />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.getAttribute("tabindex"))).toEqual(["0", "-1", "-1"]);
  });

  it("passe à la récompense suivante toutes les huit secondes, et reboucle", () => {
    vi.useFakeTimers();
    render(<AwardsCarousel slides={SLIDES} />);

    advance(AUTOPLAY_MS - 1);
    expect(selectedTab()).toHaveTextContent("Chip Winner");
    advance(1);
    expect(selectedTab()).toHaveTextContent("Chip Riser");
    advance(AUTOPLAY_MS);
    expect(selectedTab()).toHaveTextContent("Chip Joke game");
    advance(AUTOPLAY_MS);
    expect(selectedTab()).toHaveTextContent("Chip Winner");
  });

  it("montre une barre de progression sur la puce active", () => {
    vi.useFakeTimers();
    render(<AwardsCarousel slides={SLIDES} />);

    expect(within(selectedTab()).getByTestId("award-progress")).toBeInTheDocument();
    expect(screen.getAllByTestId("award-progress")).toHaveLength(1);
  });

  it("ne défile jamais tout seul quand le lecteur réduit les animations", () => {
    mockReducedMotion(true);
    vi.useFakeTimers();
    render(<AwardsCarousel slides={SLIDES} />);

    advance(AUTOPLAY_MS * 5);
    expect(selectedTab()).toHaveTextContent("Chip Winner");
    expect(screen.queryByTestId("award-progress")).not.toBeInTheDocument();
  });

  it("se met en pause au survol et reprend là où il en était", () => {
    vi.useFakeTimers();
    render(<AwardsCarousel slides={SLIDES} />);
    const region = screen.getByRole("region", { name: "Awards" });

    advance(AUTOPLAY_MS / 2);
    fireEvent.mouseEnter(region);
    expect(screen.getByTestId("award-progress").style.animationPlayState).toBe("paused");
    advance(AUTOPLAY_MS * 3);
    expect(selectedTab()).toHaveTextContent("Chip Winner");

    fireEvent.mouseLeave(region);
    advance(AUTOPLAY_MS / 2);
    expect(selectedTab()).toHaveTextContent("Chip Riser");
  });

  it("se met en pause tant que le focus est dans le carrousel", () => {
    vi.useFakeTimers();
    render(<AwardsCarousel slides={SLIDES} />);

    act(() => screen.getAllByRole("tab")[0].focus());
    advance(AUTOPLAY_MS * 3);
    expect(selectedTab()).toHaveTextContent("Chip Winner");

    act(() => screen.getAllByRole("tab")[0].blur());
    advance(AUTOPLAY_MS);
    expect(selectedTab()).toHaveTextContent("Chip Riser");
  });

  it("se met en pause quand l'onglet du navigateur est masqué", () => {
    vi.useFakeTimers();
    render(<AwardsCarousel slides={SLIDES} />);

    act(() => setPageHidden(true));
    advance(AUTOPLAY_MS * 3);
    expect(selectedTab()).toHaveTextContent("Chip Winner");

    act(() => setPageHidden(false));
    advance(AUTOPLAY_MS);
    expect(selectedTab()).toHaveTextContent("Chip Riser");
  });

  it("repart de zéro quand le lecteur choisit une puce", () => {
    vi.useFakeTimers();
    render(<AwardsCarousel slides={SLIDES} />);

    advance(AUTOPLAY_MS - 1000);
    fireEvent.click(screen.getByRole("tab", { name: "Chip Joke game" }));
    advance(1000);
    expect(selectedTab()).toHaveTextContent("Chip Joke game");
  });

  it("relance huit secondes pleines quand on revient sur une diapositive mise en pause", () => {
    vi.useFakeTimers();
    render(<AwardsCarousel slides={SLIDES} />);
    const region = screen.getByRole("region", { name: "Awards" });

    advance(AUTOPLAY_MS - 1000);
    fireEvent.mouseEnter(region);
    fireEvent.click(screen.getByRole("tab", { name: "Chip Riser" }));
    fireEvent.click(screen.getByRole("tab", { name: "Chip Winner" }));
    fireEvent.mouseLeave(region);

    advance(1000);
    expect(selectedTab()).toHaveTextContent("Chip Winner");
    advance(AUTOPLAY_MS - 1000);
    expect(selectedTab()).toHaveTextContent("Chip Riser");
  });

  it("ne lance pas de défilement pour une seule récompense", () => {
    vi.useFakeTimers();
    render(<AwardsCarousel slides={[SLIDES[0]]} />);

    advance(AUTOPLAY_MS * 2);
    expect(selectedTab()).toHaveTextContent("Chip Winner");
    expect(screen.queryByTestId("award-progress")).not.toBeInTheDocument();
  });

  it("ne rend rien quand aucune récompense n'a survécu", () => {
    const { container } = render(<AwardsCarousel slides={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("explique la règle de chaque récompense dans la bulle du kicker", () => {
    render(<AwardsCarousel slides={SLIDES} />);

    expect(screen.getByRole("button", { name: "Hint for Winner." })).toBeInTheDocument();
    expect(screen.getByText("label Winner · 07 Sep – 13 Sep")).toBeInTheDocument();
  });

  it("rend le BBCode de la citation plutôt que ses balises", () => {
    render(<AwardsCarousel slides={SLIDES} />);

    const quote = within(screen.getByRole("tabpanel")).getByText(/Best/).closest("blockquote");
    expect(quote).toHaveTextContent("Best thing I played all year.");
    expect(quote?.querySelector("strong")).toHaveTextContent("thing");
  });

  it("fait passer la citation avant le jeu sur une diapositive de review", () => {
    render(<AwardsCarousel slides={SLIDES} />);
    fireEvent.click(screen.getByRole("tab", { name: "Chip Joke game" }));

    const panel = screen.getByRole("tabpanel");
    const quote = within(panel).getByText(/stayed for the goose/);
    const title = within(panel).getByRole("heading", { name: "Joke game" });
    expect(quote.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(panel).getByText("42")).toBeInTheDocument();
    expect(within(panel).getByText("found it funny")).toBeInTheDocument();
    expect(within(panel).getByText("by goosefan · 13 hrs at review")).toBeInTheDocument();
  });

  it("mène chaque récompense vers la fiche de son jeu", () => {
    render(<AwardsCarousel slides={SLIDES} />);

    expect(within(screen.getByRole("tabpanel")).getByRole("link", { name: "Read the reviews" })).toHaveAttribute(
      "href",
      `/games/${SLIDES[0].appId}`,
    );
  });
});
