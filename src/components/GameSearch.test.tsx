import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameSearch } from "@/components/GameSearch";
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

describe("GameSearch", () => {
  it("suggests matching games once the query is long enough", async () => {
    const fetchMock = mockSearch();
    render(<GameSearch selected={null} />);

    await userEvent.type(screen.getByRole("combobox"), "bal");

    expect(await screen.findByRole("option", { name: /Baldur's Gate III/ })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/games/search?q=bal", expect.anything());
  });

  it("does not query the API for a single character", async () => {
    const fetchMock = mockSearch();
    render(<GameSearch selected={null} />);

    await userEvent.type(screen.getByRole("combobox"), "b");
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("filters the map on the clicked game", async () => {
    mockSearch();
    render(<GameSearch selected={null} />);

    await userEvent.type(screen.getByRole("combobox"), "bal");
    await userEvent.click(await screen.findByRole("option", { name: /Baldur's Gate III/ }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/map?app=1086940"));
  });

  it("moves through the suggestions with the arrow keys and validates with Enter", async () => {
    mockSearch();
    render(<GameSearch selected={null} />);

    const input = screen.getByRole("combobox");
    await userEvent.type(input, "the");
    await screen.findByRole("option", { name: /Baldur's Gate III/ });

    await userEvent.keyboard("{ArrowDown}{Enter}");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/map?app=292030"));
  });

  it("closes the suggestions on Escape", async () => {
    mockSearch();
    render(<GameSearch selected={null} />);

    await userEvent.type(screen.getByRole("combobox"), "bal");
    await screen.findByRole("listbox");

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("reports an empty result set instead of an empty dropdown", async () => {
    mockSearch([]);
    render(<GameSearch selected={null} />);

    await userEvent.type(screen.getByRole("combobox"), "zzzz");

    expect(await screen.findByText(/No game matches/)).toBeInTheDocument();
  });

  it("shows the active game and clears the filter from its chip", async () => {
    mockSearch();
    render(<GameSearch selected={hits[0]} />);

    expect(screen.getByText("Baldur's Gate III")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Remove the .* filter/ }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/map"));
  });

  it("disables the Global pill when no game is selected", () => {
    mockSearch();
    render(<GameSearch selected={null} />);

    expect(screen.getByRole("button", { name: "Global" })).toBeDisabled();
  });
});
