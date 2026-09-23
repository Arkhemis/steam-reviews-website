import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BattleArena, type BattleFighter } from "@/components/BattleArena";
import { battleOutcome, buildRounds, type Fighter } from "@/lib/battle";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const stats = (overrides: Partial<Fighter>): Fighter => ({
  appId: 1,
  name: "Alpha",
  pctPositive: 0.95,
  totalReviews: 800_000,
  playtimeMedianMinutes: 6000,
  pctRefunded: 0.01,
  pctSteamDeck: 0.1,
  firstReleaseDate: "2023-01-01",
  store: null,
  ...overrides,
});

const alpha = stats({});
const beta = stats({ appId: 2, name: "Beta", pctPositive: 0.6, totalReviews: 100_000, playtimeMedianMinutes: 900, pctRefunded: 0.05, pctSteamDeck: 0.01 });

const card = (f: Fighter): BattleFighter => ({
  appId: f.appId,
  name: f.name,
  coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1.jpg",
  pct: f.pctPositive,
  ratingLabel: "Very Positive",
  ratingColor: "var(--status-good)",
  totalReviews: f.totalReviews,
});

function renderArena() {
  const rounds = buildRounds(alpha, beta);
  return render(<BattleArena left={card(alpha)} right={card(beta)} rounds={rounds} outcome={battleOutcome(rounds)} />);
}

describe("BattleArena", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("ouvre sur le « FIGHT! » sans dévoiler de round", () => {
    renderArena();
    expect(screen.getByText("FIGHT!")).toBeInTheDocument();
    expect(document.querySelectorAll('[data-revealed="true"]')).toHaveLength(0);
  });

  it("dévoile les rounds un par un puis annonce le vainqueur", () => {
    renderArena();
    act(() => vi.advanceTimersByTime(1800 + 1250));
    expect(document.querySelectorAll('[data-revealed="true"]')).toHaveLength(1);

    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.getByText("Flawless victory")).toBeInTheDocument();
    expect(screen.getByText(/Alpha wins/)).toBeInTheDocument();
  });

  it("saute au résultat, et un round en attente ne le rembobine pas", () => {
    renderArena();
    fireEvent.click(screen.getByRole("button", { name: /skip to the result/i }));
    act(() => vi.advanceTimersByTime(30_000));
    expect(document.querySelectorAll('[data-revealed="true"]')).toHaveLength(5);
    expect(screen.getByText(/Alpha wins/)).toBeInTheDocument();
  });

  it("pose le Chad sur la jaquette du vainqueur seulement", () => {
    renderArena();
    fireEvent.click(screen.getByRole("button", { name: /skip to the result/i }));
    const chads = document.querySelectorAll('img[src*="chad.png"]');
    expect(chads).toHaveLength(1);
    expect(chads[0].closest("a")).toHaveAttribute("href", "/games/1");
  });

  it("rejoue le combat depuis le début au « Rematch »", () => {
    renderArena();
    fireEvent.click(screen.getByRole("button", { name: /skip to the result/i }));
    fireEvent.click(screen.getByRole("button", { name: "Rematch" }));
    expect(screen.getByText("FIGHT!")).toBeInTheDocument();
    expect(document.querySelectorAll('[data-revealed="true"]')).toHaveLength(0);
  });
});
