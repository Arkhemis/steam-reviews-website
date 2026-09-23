import { describe, expect, it } from "vitest";
import {
  aiMove,
  BOMB_COOLDOWN,
  canUse,
  createDuel,
  critFor,
  dodgeFor,
  duelStats,
  hpFor,
  MAX_TURNS,
  powerFor,
  refundWeaknessFor,
  pickQuotes,
  QUOTE_MAX,
  quoteText,
  takeTurn,
  type DuelStats,
} from "@/lib/duel";
import type { Fighter } from "@/lib/battle";

function stats(overrides: Partial<DuelStats> = {}): DuelStats {
  return { maxHp: 100, power: 20, approval: 0.8, crit: 0, dodge: 0, refundWeakness: 0, initiative: 1000, ...overrides };
}

describe("stats de duel", () => {
  it("tire les PV du temps de jeu, en log et plafonnés", () => {
    expect(hpFor(0)).toBe(80);
    expect(hpFor(4 * 60)).toBe(102);
    expect(hpFor(60 * 60)).toBe(168);
    expect(hpFor(1e7)).toBe(200);
  });

  it("tire la puissance de la part positive", () => {
    expect(powerFor(0.95)).toBe(31);
    expect(powerFor(0.4)).toBe(18);
    expect(powerFor(2)).toBe(32);
  });

  it("borne critique, esquive et fragilité aux remboursements", () => {
    expect(critFor(1_000)).toBeCloseTo(0.05);
    expect(critFor(1_000_000)).toBeCloseTo(0.11);
    expect(critFor(1e20)).toBe(0.2);
    expect(dodgeFor(0.005)).toBeCloseTo(0.07);
    expect(dodgeFor(1)).toBe(0.3);
    expect(refundWeaknessFor(0.01)).toBeCloseTo(0.45);
    expect(refundWeaknessFor(1)).toBe(0.75);
  });

  it("assemble les stats d'une fiche", () => {
    const game: Fighter = {
      appId: 1,
      name: "Test",
      pctPositive: 0.95,
      totalReviews: 1_000_000,
      playtimeMedianMinutes: 240,
      pctRefunded: 0.01,
      pctSteamDeck: 0.005,
    };
    expect(duelStats(game)).toMatchObject({ maxHp: 102, power: 31, approval: 0.95, initiative: 1_000_000 });
  });
});

describe("déroulé du duel", () => {
  it("laisse ouvrir le jeu le plus commenté", () => {
    expect(createDuel(stats(), stats({ initiative: 5000 }), 1).turn).toBe("right");
    expect(createDuel(stats(), stats(), 1).turn).toBe("left");
  });

  it("alterne les tours et retire des PV", () => {
    const state = createDuel(stats(), stats(), 7);
    const event = takeTurn(state, "sucks");
    expect(event.actor).toBe("left");
    expect(state.turn).toBe("right");
    if (event.outcome === "hit") expect(state.hp.right).toBe(100 - event.damage);
  });

  it("interdit le Review Bomb pendant sa recharge", () => {
    const state = createDuel(stats(), stats(), 3);
    takeTurn(state, "bomb");
    takeTurn(state, "sucks");
    expect(state.bombCooldown.left).toBe(BOMB_COOLDOWN);
    expect(canUse(state, "left", "bomb")).toBe(false);
    expect(() => takeTurn(state, "bomb")).toThrow();
  });

  it("retourne un Review Bomb raté contre son auteur", () => {
    // Aucune approbation : 30 % de précision, on finit par rater.
    for (let seed = 1; seed < 50; seed++) {
      const state = createDuel(stats({ approval: 0 }), stats(), seed);
      const event = takeTurn(state, "bomb");
      if (event.outcome === "backfire") {
        expect(state.hp.left).toBe(100 - event.selfDamage);
        expect(state.hp.right).toBe(100);
        return;
      }
    }
    throw new Error("aucun retour de flamme en 50 graines");
  });

  it("fait sauter le tour d'un jeu remboursé", () => {
    const state = createDuel(stats(), stats({ refundWeakness: 1 }), 11);
    let event = takeTurn(state, "refund");
    while (event.outcome === "miss") {
      takeTurn(state, "sucks");
      event = takeTurn(state, "refund");
    }
    expect(event.stunned).toBe(true);
    const skipped = takeTurn(state, "sucks");
    expect(skipped).toMatchObject({ actor: "right", move: null, outcome: "skip" });
    expect(state.stunned.right).toBe(false);
  });

  it("soigne sans dépasser les PV max, deux fois seulement", () => {
    const state = createDuel(stats(), stats(), 5);
    expect(canUse(state, "left", "patch")).toBe(false);
    state.hp.left = 90;
    expect(takeTurn(state, "patch")).toMatchObject({ outcome: "heal", heal: 10 });
    state.hp.left = 10;
    state.turn = "left";
    takeTurn(state, "patch");
    state.hp.left = 10;
    state.turn = "left";
    expect(canUse(state, "left", "patch")).toBe(false);
  });

  it("finit toujours, avec un vainqueur quand un camp tombe", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const state = createDuel(stats({ power: 30 }), stats({ maxHp: 150 }), seed);
      while (!state.over) takeTurn(state, aiMove(state));
      expect(state.turns).toBeLessThanOrEqual(MAX_TURNS);
      if (state.hp.left === 0 || state.hp.right === 0) expect(state.winner).not.toBeNull();
    }
  });

  it("refuse de jouer après la fin", () => {
    const state = createDuel(stats({ power: 500 }), stats(), 1);
    state.random = () => 0.5;
    takeTurn(state, "sucks");
    expect(state).toMatchObject({ over: true, winner: "left" });
    expect(() => takeTurn(state, "sucks")).toThrow();
  });

  it("rejoue le même duel avec la même graine et les mêmes coups", () => {
    const play = () => {
      const state = createDuel(stats(), stats({ dodge: 0.2, crit: 0.1 }), 42);
      const log: string[] = [];
      while (!state.over) log.push(takeTurn(state, aiMove(state)).outcome);
      return log;
    };
    expect(play()).toEqual(play());
  });
});

describe("répliques", () => {
  const review = (reviewText: string, votesFunny = 0, votedUp = false, votesUp = 0) => ({ reviewText, votedUp, votesFunny, votesUp });

  it("nettoie le BBCode et garde une review courte entière", () => {
    expect(quoteText("[b]Great[/b]   game, would play again\n\nhttps://x.y/z")).toBe("Great game, would play again");
  });

  it("réduit une review longue à sa première phrase, ou l'écarte", () => {
    const long = `Best RPG ever made, period. ${"And then some more words. ".repeat(10)}`;
    expect(quoteText(long)).toBe("Best RPG ever made, period.");
    expect(quoteText("word ".repeat(60))).toBeNull();
    expect(quoteText("10/10")).toBeNull();
    expect(quoteText(`${"a".repeat(QUOTE_MAX + 5)}. Short.`)).toBeNull();
  });

  it("ne garde qu'un bord et met les plus drôles en tête", () => {
    const picked = pickQuotes(
      [
        review("this game is for virgins and i am one aswell", 3),
        review("This review is not funny at all, just long enough.", 0, false, 500),
        review("I love it so much, no notes at all, masterpiece", 99, true),
        review("best feature is the 120gbs you gain from uninstalling it", 40),
      ],
      false,
    );
    expect(picked.map((q) => q.votesFunny)).toEqual([40, 3, 0]);
    expect(picked.every((q) => q.text.length <= QUOTE_MAX)).toBe(true);
  });
});
