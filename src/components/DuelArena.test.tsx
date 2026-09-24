import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DuelArena, type DuelCorner } from "@/components/DuelArena";
import { duelStats } from "@/lib/duel";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

// Le son passe par Web Audio, absent de jsdom : on le coupe.
vi.mock("@/components/duel/sound", () => ({
  BLEEP_MS: 450,
  DuelAudio: class {
    unlock() {}
    setMuted() {}
    setMusicMuted() {}
    setDanger() {}
    duck() {}
    startMusic() {}
    stopMusic() {}
    dispose() {}
    play() {}
  },
}));

function corner(appId: number, name: string): DuelCorner {
  const game = {
    appId,
    name,
    pctPositive: 0.9,
    totalReviews: 50_000,
    playtimeMedianMinutes: 600,
    pctRefunded: 0.02,
    pctSteamDeck: 0.01,
  };
  return {
    fighter: { appId, name, coverUrl: null, pct: 0.9, ratingLabel: "Very Positive", ratingColor: "#66c0f4", totalReviews: 50_000 },
    stats: duelStats(game),
    sources: { reviews: "50K", hours: "10h", positive: "90%", refunded: "2.0%", deck: "1.0%" },
    cheers: [{ text: "Great game.", author: "fan", hours: 12 }],
    jeers: [{ text: "Terrible game.", author: "hater", hours: 3 }],
  };
}

function renderArena(langParam?: string) {
  return render(
    <DuelArena
      left={corner(570, "Dota 2")}
      right={corner(730, "Counter-Strike 2")}
      language="english"
      languages={[{ key: "english", label: "English" }]}
      langParam={langParam}
    />,
  );
}

beforeEach(() => {
  push.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DuelArena", () => {
  it("revient à l'écran de choix depuis le duel", async () => {
    renderArena();
    await userEvent.click(screen.getByRole("button", { name: "Play as Dota 2" }));
    expect(screen.queryByText("choose your fighter")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Back to the fighter menu" }));

    expect(screen.getByText("choose your fighter")).toBeInTheDocument();
  });

  it("relance le duel au Rematch, l'ordinateur rejouant son premier tour", async () => {
    // `userEvent` attend des timers réels : sous timers simulés, `fireEvent`.
    vi.useFakeTimers();
    try {
      renderArena();
      // À initiative égale, la gauche ouvre : en jouant la droite, l'ordinateur commence.
      fireEvent.click(screen.getByRole("button", { name: "Play as Counter-Strike 2" }));
      const sucks = () => screen.getByRole("button", { name: /Your Game Sucks/ });

      // Joue jusqu'au bout, coup après coup.
      for (let i = 0; i < 400 && !screen.queryByRole("button", { name: "Rematch" }); i++) {
        await act(() => vi.advanceTimersByTimeAsync(500));
        const button = screen.queryByRole("button", { name: /Your Game Sucks/ });
        if (button && !button.hasAttribute("disabled")) fireEvent.click(button);
      }
      fireEvent.click(screen.getByRole("button", { name: "Rematch" }));

      // L'ordinateur rouvre la manche, puis le joueur reprend la main.
      await act(() => vi.advanceTimersByTimeAsync(10_000));
      expect(sucks()).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  }, 20_000);

  it("tire une rivalité au hasard dès l'écran de choix, sans figer la langue du navigateur", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ leftAppId: 10, rightAppId: 20 }))));
    renderArena();

    await userEvent.click(screen.getByRole("button", { name: /Random rivalry/ }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/battle?game=10&vs=20"));
  });

  it("garde une langue choisie dans le lien de la rivalité tirée", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ leftAppId: 10, rightAppId: 20 }))));
    renderArena("french");

    await userEvent.click(screen.getByRole("button", { name: /Random rivalry/ }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/battle?game=10&vs=20&lang=french"));
  });
});
