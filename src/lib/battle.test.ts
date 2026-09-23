import { describe, expect, it } from "vitest";
import { battleOutcome, buildRounds, formatRatio, healthAfter, resolveMatchup, type Fighter } from "@/lib/battle";

function fighter(overrides: Partial<Fighter>): Fighter {
  return {
    appId: 1,
    name: "Alpha",
    pctPositive: 0.9,
    totalReviews: 100_000,
    playtimeMedianMinutes: 600,
    pctRefunded: 0.02,
    pctSteamDeck: 0.05,
    firstReleaseDate: "2023-01-01",
    store: {
      appType: "game",
      priceUsd: 60,
      isFree: false,
      isEarlyAccess: false,
      isComingSoon: false,
      isAvailable: true,
      parentGame: null,
    },
    ...overrides,
  };
}

describe("buildRounds", () => {
  it("joue six rounds quand les deux jeux ont un prix", () => {
    const rounds = buildRounds(fighter({}), fighter({ appId: 2, name: "Beta" }));
    expect(rounds.map((r) => r.key)).toEqual(["score", "playtime", "volume", "refunds", "deck", "revenue"]);
  });

  it("saute le round du revenu quand un des jeux est gratuit", () => {
    const free = fighter({ appId: 2, name: "Beta", store: { ...fighter({}).store!, isFree: true, priceUsd: null } });
    expect(buildRounds(fighter({}), free).map((r) => r.key)).not.toContain("revenue");
  });

  it("donne le round des remboursements au plus bas taux", () => {
    const rounds = buildRounds(fighter({ pctRefunded: 0.01 }), fighter({ appId: 2, name: "Beta", pctRefunded: 0.04 }));
    const refunds = rounds.find((r) => r.key === "refunds")!;
    expect(refunds.winner).toBe("left");
    expect(refunds.critical).toBe(true);
    expect(refunds.commentary).toBe("Beta gets refunded 4.0× as often. Ouch.");
  });

  it("déclare l'égalité sur les chiffres affichés, pas sur les décimales", () => {
    const rounds = buildRounds(fighter({ pctPositive: 0.971 }), fighter({ appId: 2, name: "Beta", pctPositive: 0.968 }));
    const score = rounds.find((r) => r.key === "score")!;
    expect(score.winner).toBeNull();
    expect(score.commentary).toBe("Dead heat at 97%. The players can't pick.");
  });

  it("écrit le commentaire d'un écrasement à partir de l'écart réel", () => {
    const rounds = buildRounds(fighter({ pctPositive: 0.96 }), fighter({ appId: 2, name: "Beta", pctPositive: 0.59 }));
    const score = rounds.find((r) => r.key === "score")!;
    expect(score.winner).toBe("left");
    expect(score.critical).toBe(true);
    expect(score.commentary).toBe("Alpha flattens Beta by 37 points.");
  });

  it("met la barre du meneur au bord pour les compteurs sans échelle fixe", () => {
    const rounds = buildRounds(fighter({ totalReviews: 400 }), fighter({ appId: 2, name: "Beta", totalReviews: 100 }));
    const volume = rounds.find((r) => r.key === "volume")!;
    expect(volume.leftFillPct).toBe(100);
    expect(volume.rightFillPct).toBe(25);
  });
});

describe("battleOutcome", () => {
  const left = fighter({ pctPositive: 0.95, playtimeMedianMinutes: 6000, totalReviews: 800_000, pctRefunded: 0.01, pctSteamDeck: 0.1 });
  const right = fighter({ appId: 2, name: "Beta", pctPositive: 0.6, playtimeMedianMinutes: 900, totalReviews: 100_000, pctRefunded: 0.05, pctSteamDeck: 0.01 });

  it("parle de victoire parfaite quand le perdant ne gagne aucun round", () => {
    expect(battleOutcome(buildRounds(left, right))).toEqual({ winner: "left", leftWins: 6, rightWins: 0, verdict: "Flawless victory" });
  });

  it("finit en double K.O. sur une égalité", () => {
    expect(battleOutcome(buildRounds(left, { ...left, appId: 2, name: "Beta" }))).toMatchObject({ winner: null, verdict: "Double K.O." });
  });
});

describe("healthAfter", () => {
  it("met le perdant à zéro au dernier round", () => {
    const rounds = buildRounds(fighter({ pctPositive: 0.95, totalReviews: 900_000 }), fighter({ appId: 2, name: "Beta", pctPositive: 0.5, playtimeMedianMinutes: 900 }));
    const { leftWins, rightWins } = battleOutcome(rounds);
    expect(leftWins).toBeGreaterThan(rightWins);
    expect(healthAfter(rounds, 0)).toEqual({ left: 100, right: 100 });
    const end = healthAfter(rounds, rounds.length);
    expect(end.right).toBe(0);
    expect(end.left).toBeCloseTo(100 - rightWins * (100 / leftWins));
  });

  it("laisse le vainqueur d'une victoire parfaite intact", () => {
    const rounds = buildRounds(
      fighter({ pctPositive: 0.95, playtimeMedianMinutes: 6000, totalReviews: 800_000, pctRefunded: 0.01, pctSteamDeck: 0.1 }),
      fighter({ appId: 2, name: "Beta", pctPositive: 0.6, playtimeMedianMinutes: 900, totalReviews: 100_000, pctRefunded: 0.05, pctSteamDeck: 0.01 }),
    );
    expect(healthAfter(rounds, rounds.length)).toEqual({ left: 100, right: 0 });
  });
});

describe("resolveMatchup", () => {
  it("n'oppose jamais un jeu à lui-même", () => {
    expect(resolveMatchup("1086940", "1086940")).toEqual({ leftAppId: 1086940, rightAppId: 1716740 });
    expect(resolveMatchup("570", "570")).toEqual({ leftAppId: 570, rightAppId: 1086940 });
  });
});

describe("formatRatio", () => {
  it("garde une décimale sous dix seulement", () => {
    expect(formatRatio(2.34)).toBe("2.3×");
    expect(formatRatio(14.6)).toBe("15×");
  });
});
