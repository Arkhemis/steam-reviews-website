import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import GamePage from "@/app/games/[appId]/page";
import { BALDURS_GATE_3_APP_ID } from "@/lib/data/fixtures/baldursGate3";

describe("GamePage", () => {
  it("renders the game name, KPIs, and reviews for a known app id", async () => {
    const jsx = await GamePage({ params: Promise.resolve({ appId: String(BALDURS_GATE_3_APP_ID) }) });
    render(jsx);

    expect(screen.getByText("Baldur's Gate III")).toBeInTheDocument();
    expect(screen.getByText("97%")).toBeInTheDocument();
    expect(screen.getByText(/Superbe jeu, rien à redire/)).toBeInTheDocument();
  });

  it("renders a not-found message for an unknown app id", async () => {
    const jsx = await GamePage({ params: Promise.resolve({ appId: "999999999" }) });
    render(jsx);

    expect(screen.getByText(/introuvable/i)).toBeInTheDocument();
  });
});
