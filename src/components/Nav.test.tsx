import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Nav } from "@/components/Nav";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("Nav", () => {
  it("renders the brand name and nav links", () => {
    render(<Nav />);
    expect(screen.getByText("steam.reviews")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Games" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Charts" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Language map" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Battle" })).toBeInTheDocument();
  });

  // La barre est la même sur toutes les pages : sans repère, le lecteur ne
  // voit pas où il est.
  it("souligne la section courante, et elle seule", () => {
    render(<Nav active="charts" />);
    expect(screen.getByRole("link", { name: "Charts" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Language map" })).not.toHaveAttribute("aria-current");
  });

  it("ne souligne rien quand aucune section n'est demandée", () => {
    render(<Nav />);
    for (const name of ["Games", "Charts", "Language map"]) {
      expect(screen.getByRole("link", { name })).not.toHaveAttribute("aria-current");
    }
  });

  it("offers the game search next to the brand", () => {
    render(<Nav />);
    expect(screen.getByRole("combobox", { name: "Search a game" })).toBeInTheDocument();
  });
});
