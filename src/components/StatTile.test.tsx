import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatTile } from "@/components/StatTile";

describe("StatTile", () => {
  it("renders the label and value", () => {
    render(<StatTile label="Positive score" value="97%" />);
    expect(screen.getByText("97%")).toBeInTheDocument();
    expect(screen.getByText("Positive score")).toBeInTheDocument();
  });

  // Sans la note, « 46h » ne dit pas si c'est le temps de jeu au moment de
  // l'avis ou depuis toujours.
  it("carries the note that says what the number counts", () => {
    render(<StatTile label="median playtime" value="46h" note="all time, per reviewer" />);
    expect(screen.getByText("all time, per reviewer")).toBeInTheDocument();
  });
});
