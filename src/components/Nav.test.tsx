import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Nav } from "@/components/Nav";

describe("Nav", () => {
  it("renders the brand name and nav links", () => {
    render(<Nav />);
    expect(screen.getByText("steam.reviews")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Games" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Charts" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Language map" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Battle" })).toBeInTheDocument();
  });
});
