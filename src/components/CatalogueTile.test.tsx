import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatalogueTile, ShelfTile } from "@/components/CatalogueTile";
import type { CatalogueGame } from "@/lib/data/types";

const GAME: CatalogueGame = {
  appId: 1086940,
  name: "Baldur's Gate III",
  coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co670h.jpg",
  totalReviews: 780200,
  pctPositive: 0.96,
};

describe("CatalogueTile", () => {
  it("mène à la fiche du jeu et annonce son score", () => {
    render(<CatalogueTile game={GAME} sizes="12vw" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/games/1086940");
    expect(screen.getByText("Baldur's Gate III")).toBeInTheDocument();
    expect(screen.getByText("96%")).toBeInTheDocument();
    expect(screen.getByText("780.2K")).toBeInTheDocument();
  });

  it("signe la variation, hausse comme baisse", () => {
    const { rerender } = render(<CatalogueTile game={{ ...GAME, deltaPct: 6.8 }} sizes="12vw" />);
    expect(screen.getByText("+6.8")).toBeInTheDocument();

    rerender(<CatalogueTile game={{ ...GAME, deltaPct: -4.25 }} sizes="12vw" />);
    expect(screen.getByText("-4.3")).toBeInTheDocument();
  });

  // Un jeu trop peu commenté pour qu'une comparaison veuille dire quelque
  // chose arrive sans `deltaPct` : la vignette ne doit pas afficher « +0.0 »,
  // qui se lirait comme « n'a pas bougé ».
  it("n'invente pas de variation quand le jeu n'en a pas", () => {
    render(<CatalogueTile game={GAME} sizes="12vw" />);
    expect(screen.queryByText(/^[+-]/)).not.toBeInTheDocument();
  });

  it("rend la vignette sans jaquette plutôt que rien", () => {
    render(<CatalogueTile game={{ ...GAME, coverUrl: null }} sizes="12vw" />);
    expect(screen.getByRole("link")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

describe("ShelfTile", () => {
  it("montre le score et le volume, sans variation", () => {
    render(<ShelfTile game={{ ...GAME, deltaPct: 6.8 }} sizes="12vw" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/games/1086940");
    expect(screen.getByText("96%")).toBeInTheDocument();
    expect(screen.getByText("780.2K")).toBeInTheDocument();
    expect(screen.queryByText("+6.8")).not.toBeInTheDocument();
  });
});
