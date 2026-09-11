import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameSearchBox } from "@/components/GameSearchBox";
import type { GameSearchHit } from "@/lib/gameSearch";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const hits: GameSearchHit[] = [
  { appId: 1086940, name: "Baldur's Gate III", coverUrl: null, totalReviews: 87000, pctPositive: 0.96 },
  { appId: 292030, name: "The Witcher 3", coverUrl: null, totalReviews: 65000, pctPositive: 0.98 },
];

function mockSearch(games: GameSearchHit[] = hits) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ games })));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  push.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GameSearchBox", () => {
  it("suggests matching games once the query is long enough", async () => {
    const fetchMock = mockSearch();
    render(<GameSearchBox placeholder="Search games…" />);

    await userEvent.type(screen.getByRole("combobox"), "bal");

    expect(await screen.findByRole("option", { name: /Baldur's Gate III/ })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/games/search?q=bal", expect.anything());
  });

  it("opens the game page of the clicked suggestion", async () => {
    mockSearch();
    render(<GameSearchBox placeholder="Search games…" />);

    await userEvent.type(screen.getByRole("combobox"), "bal");
    await userEvent.click(await screen.findByRole("option", { name: /Baldur's Gate III/ }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/games/1086940"));
  });

  it("moves through the suggestions with the arrow keys and validates with Enter", async () => {
    mockSearch();
    render(<GameSearchBox placeholder="Search games…" />);

    await userEvent.type(screen.getByRole("combobox"), "the");
    await screen.findByRole("option", { name: /Baldur's Gate III/ });

    await userEvent.keyboard("{ArrowDown}{Enter}");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/games/292030"));
  });

  it("falls back to the catalogue listing when Enter is pressed without a suggestion", async () => {
    mockSearch([]);
    render(<GameSearchBox placeholder="Search games…" />);

    await userEvent.type(screen.getByRole("combobox"), "zzzz");
    await screen.findByText(/No game matches/);

    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/games?q=zzzz"));
  });

  it("does not query the API for a single character", async () => {
    const fetchMock = mockSearch();
    render(<GameSearchBox placeholder="Search games…" />);

    await userEvent.type(screen.getByRole("combobox"), "b");
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("closes the suggestions on Escape", async () => {
    mockSearch();
    render(<GameSearchBox placeholder="Search games…" />);

    await userEvent.type(screen.getByRole("combobox"), "bal");
    await screen.findByRole("listbox");

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
