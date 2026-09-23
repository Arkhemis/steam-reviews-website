import { describe, expect, it } from "vitest";
import {
  createBattle,
  defaultSeed,
  desertionFor,
  FIELD_W,
  hpFor,
  MAX_TICKS,
  odds,
  raiseArmy,
  ridersFor,
  simulate,
  step,
  tally,
  troopsFor,
  type ArmySpec,
} from "@/lib/armyBattle";
import type { Fighter } from "@/lib/battle";

function army(overrides: Partial<ArmySpec>): ArmySpec {
  return { side: "left", troops: 20, hp: 5, accuracy: 0.8, desertion: 0, riders: 0, ...overrides };
}

describe("levée des armées", () => {
  it("compte les soldats en échelle log des avis", () => {
    expect(troopsFor(1_000)).toBe(10);
    expect(troopsFor(1_000_000)).toBe(34);
    expect(troopsFor(10_000_000)).toBe(42);
    expect(troopsFor(3)).toBe(6);
    expect(troopsFor(1e12)).toBe(48);
  });

  it("donne des PV selon le temps de jeu, plafonnés à 20", () => {
    expect(hpFor(0)).toBe(2);
    expect(hpFor(10 * 60)).toBe(5);
    expect(hpFor(150 * 60)).toBe(14);
    expect(hpFor(100_000 * 60)).toBe(20);
  });

  it("transforme remboursements et Steam Deck en désertion et cavaliers", () => {
    expect(desertionFor(0.01)).toBeCloseTo(0.06);
    expect(desertionFor(0.5)).toBe(0.4);
    expect(ridersFor(30, 0.01)).toBe(3);
    expect(ridersFor(30, 0.2)).toBe(9);
  });

  it("prend la part d'avis positifs comme précision", () => {
    const game: Fighter = {
      appId: 1,
      name: "Alpha",
      pctPositive: 0.87,
      totalReviews: 100_000,
      playtimeMedianMinutes: 600,
      pctRefunded: 0,
      pctSteamDeck: 0,
      firstReleaseDate: null,
      store: null,
    };
    expect(raiseArmy(game, "right")).toEqual({ side: "right", troops: 26, hp: 5, accuracy: 0.87, desertion: 0, riders: 0 });
  });
});

describe("moteur de bataille", () => {
  it("rejoue exactement la même bataille pour la même graine", () => {
    const a = simulate(army({}), army({ side: "right", accuracy: 0.75 }), 42);
    const b = simulate(army({}), army({ side: "right", accuracy: 0.75 }), 42);
    expect(b.tick).toBe(a.tick);
    expect(b.winner).toBe(a.winner);
    expect(tally(b, "left")).toEqual(tally(a, "left"));
  });

  it("fait gagner l'armée nettement plus forte", () => {
    const { winner } = simulate(army({ troops: 30, hp: 10, accuracy: 0.95 }), army({ side: "right", troops: 15, hp: 2, accuracy: 0.4 }), 1);
    expect(winner).toBe("left");
  });

  it("finit toujours, avant le plafond de tics", () => {
    const state = simulate(army({}), army({ side: "right" }), 7);
    expect(state.over).toBe(true);
    expect(state.tick).toBeLessThanOrEqual(MAX_TICKS);
  });

  it("fait fuir des soldats quand la désertion est forte", () => {
    const state = simulate(army({ desertion: 0.4 }), army({ side: "right", troops: 30 }), 3);
    expect(tally(state, "left").fled).toBeGreaterThan(0);
  });

  it("ne compte que les soldats encore au combat", () => {
    const state = createBattle(army({ troops: 12 }), army({ side: "right", troops: 9 }), 1);
    expect(tally(state, "left")).toEqual({ standing: 12, dead: 0, fled: 0 });
    step(state);
    expect(tally(state, "right").standing).toBe(9);
  });

  it("garde les soldats sur le champ jusqu'à la fin", () => {
    // Régression : un soldat qui avait dépassé les lignes adverses continuait
    // « droit devant » et sortait du champ, emportant la bataille avec lui.
    const state = createBattle(army({ troops: 33, hp: 14, accuracy: 0.97, riders: 5 }), army({ side: "right", troops: 28, hp: 2, accuracy: 0.57 }), 3975131072);
    while (!state.over) {
      step(state);
      for (const u of state.units) {
        if (u.status !== "alive") continue;
        expect(u.x).toBeGreaterThanOrEqual(0);
        expect(u.x).toBeLessThanOrEqual(FIELD_W);
      }
    }
  });

  it("répartit les chances sur toutes les simulations", () => {
    const result = odds(army({}), army({ side: "right" }), 10);
    expect(result.left + result.right + result.draws).toBe(10);
  });

  it("tire une graine par défaut stable pour une paire de jeux", () => {
    expect(defaultSeed(570, 730)).toBe(defaultSeed(570, 730));
    expect(defaultSeed(570, 730)).not.toBe(defaultSeed(730, 570));
  });
});
