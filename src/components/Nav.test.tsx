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

  it("offers the game search next to the brand", () => {
    render(<Nav />);
    expect(screen.getByRole("combobox", { name: "Chercher un jeu" })).toBeInTheDocument();
  });
});
