import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatTile } from "@/components/StatTile";

describe("StatTile", () => {
  it("renders the label and value", () => {
    render(<StatTile label="Score positif" value="97%" />);
    expect(screen.getByText("97%")).toBeInTheDocument();
    expect(screen.getByText("Score positif")).toBeInTheDocument();
  });
});
