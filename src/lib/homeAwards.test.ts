import { describe, expect, it } from "vitest";
import {
  buildAwards,
  excerpt,
  formatDeltaPoints,
  formatPlaytime,
  pickReviewHighlights,
  type AwardSources,
  type AwardThresholds,
} from "@/lib/homeAwards";
import type { GameStats, RankedWindow, WindowMover, WindowReviewHighlight, WindowedGame } from "@/lib/data/types";

const THRESHOLDS: AwardThresholds = {
  moverMinReviews: 100,
  yearMinReviews: 1000,
  hatedMinReviews: 500,
  hiddenGemMinReviews: 50,
  hiddenGemMaxTotalReviews: 2000,
  polarisedMinReviews: 5000,
  reviewMinVotes: 5,
};

function windowed(appId: number, name: string, pctPositive: number, reviews = 1234): WindowedGame {
  return { appId, name, coverUrl: `https://images.igdb.com/${appId}.jpg`, reviews, pctPositive, totalReviews: 1500 };
}

function ranked(games: WindowedGame[], startsOn = "2026-09-07", endsOn = "2026-09-13"): RankedWindow {
  return games.length > 0 ? { startsOn, endsOn, games } : { startsOn: null, endsOn: null, games: [] };
}

function mover(appId: number, previous: number, current: number): WindowMover {
  return {
    appId,
    name: `Mover ${appId}`,
    coverUrl: null,
    reviews: 420,
    pctPositive: current,
    previousPctPositive: previous,
    deltaPts: Math.round((current - previous) * 10000) / 100,
    startsOn: "2026-09-07",
    endsOn: "2026-09-13",
  };
}

function highlight(recommendationId: number, rank: number, extra: Partial<WindowReviewHighlight> = {}): WindowReviewHighlight {
  return {
    rank,
    recommendationId,
    appId: 100 + recommendationId,
    gameName: `Game ${recommendationId}`,
    coverUrl: null,
    reviewText: `Review ${recommendationId}`,
    votedUp: true,
    votesUp: 310,
    votesFunny: 42,
    authorPersonaname: `author${recommendationId}`,
    authorPlaytimeAtReviewMinutes: 750,
    createdAt: "2026-09-01T12:00:00.000Z",
    startsOn: "2026-08-15",
    endsOn: "2026-09-13",
    ...extra,
  };
}

function polarised(appId: number): GameStats {
  return {
    appId,
    name: "Divisive",
    genres: [],
    developers: [],
    publishers: [],
    coverUrl: null,
    firstReleaseDate: null,
    totalReviews: 52_000,
    reviewScore: 5,
    pctPositive: 0.51,
    playtimeMedianMinutes: 0,
    pctSteamDeck: 0,
    pctRefunded: 0,
  };
}

function sources(overrides: Partial<AwardSources> = {}): AwardSources {
  return {
    podium: {
      window: ranked([windowed(1, "Week winner", 0.96), windowed(2, "Second", 0.9)]),
      days: 7,
      minReviews: 100,
    },
    movers: { up: mover(3, 0.62, 0.8), down: mover(4, 0.8, 0.56) },
    mostReviewed: ranked([windowed(5, "Busy", 0.84, 12_043)]),
    reviews: { funny: [highlight(1, 1)], helpful: [highlight(2, 1)] },
    year: ranked([windowed(6, "Year winner", 0.97)], "2026-01-01"),
    hated: ranked([windowed(7, "Hated", 0.12)], "2026-08-15"),
    hiddenGem: ranked([windowed(8, "Gem", 0.99, 64)], "2026-08-15"),
    polarised: [polarised(9)],
    quotes: {
      "best-of-week": "Best [b]thing[/b] all year.",
      comeback: "They fixed it.",
      freefall: "They broke it.",
      "most-reviewed": "Everyone is playing this.",
      "best-of-year": "Nothing came close this year.",
      "most-hated": "Do not buy.",
      "hidden-gem": "Nobody knows this one yet.",
      "nobody-agrees": "Half of us love it.",
    },
    ...overrides,
  };
}

describe("formatDeltaPoints", () => {
  it("arrondit l'écart au point et signe les hausses", () => {
    expect(formatDeltaPoints(18.2)).toBe("+18 pts");
  });

  it("écrit les baisses avec un vrai signe moins, pas un trait d'union", () => {
    expect(formatDeltaPoints(-24.4)).toBe("−24 pts");
    expect(formatDeltaPoints(-24.4)).not.toContain("-");
  });

  it("garde une décimale quand l'arrondi au point effacerait l'écart", () => {
    expect(formatDeltaPoints(0.4)).toBe("+0.4 pts");
    expect(formatDeltaPoints(-0.4)).toBe("−0.4 pts");
  });
});

describe("formatPlaytime", () => {
  it("compte en heures, avec une décimale sous les dix heures", () => {
    expect(formatPlaytime(90)).toBe("1.5 hrs");
    expect(formatPlaytime(750)).toBe("13 hrs");
  });

  it("met les milliers d'heures au format en-US", () => {
    expect(formatPlaytime(123_456 * 60)).toBe("123,456 hrs");
  });

  it("dit « hr » au singulier et compte en minutes sous l'heure", () => {
    expect(formatPlaytime(60)).toBe("1 hr");
    expect(formatPlaytime(42)).toBe("42 min");
  });
});

describe("excerpt", () => {
  it("rend un texte court tel quel, sans ses blancs de bord", () => {
    expect(excerpt("  Great game.  ")).toBe("Great game.");
  });

  it("coupe un texte long sur une espace et ferme par une ellipse", () => {
    const cut = excerpt(`${"word ".repeat(200)}end`);
    expect(cut.length).toBeLessThanOrEqual(421);
    expect(cut.endsWith("word…")).toBe(true);
  });

  it("réduit les lignes blanches à un simple saut de ligne", () => {
    expect(excerpt("First paragraph.\n\n\nSecond paragraph.")).toBe("First paragraph.\nSecond paragraph.");
  });

  it("jette les blancs de bout de ligne, qui allongent la citation pour rien", () => {
    expect(excerpt("First.   \n   Second.")).toBe("First.\nSecond.");
  });

  it("ne laisse pas une ligne blanche finir la citation", () => {
    expect(excerpt("Great game.\n\n")).toBe("Great game.");
  });

  it("compte la longueur sur le texte déjà nettoyé", () => {
    // Deux cents paragraphes d'un mot : sans le nettoyage, les lignes blanches
    // mangeraient la moitié du budget de caractères.
    const cut = excerpt("word\n\n".repeat(200));
    expect(cut.split("\n").length).toBeGreaterThan(80);
  });

  it("jette une balise BBCode laissée ouverte par la coupe", () => {
    const cut = excerpt(`${"a ".repeat(208)}[spoiler]secret[/spoiler] and more text after that`);
    expect(cut).not.toContain("[spoil");
  });
});

describe("pickReviewHighlights", () => {
  it("prend le premier rang de chaque catégorie", () => {
    const picked = pickReviewHighlights({ funny: [highlight(1, 1), highlight(3, 2)], helpful: [highlight(2, 1)] }, 5);

    expect(picked.funny?.recommendationId).toBe(1);
    expect(picked.helpful?.recommendationId).toBe(2);
  });

  it("ne montre pas deux fois la même review : la plus utile passe au rang suivant", () => {
    const shared = highlight(1, 1);
    const picked = pickReviewHighlights(
      { funny: [shared], helpful: [{ ...shared }, highlight(2, 2), highlight(3, 3)] },
      5,
    );

    expect(picked.funny?.recommendationId).toBe(1);
    expect(picked.helpful?.recommendationId).toBe(2);
  });

  it("laisse la plus utile au premier rang quand la plus drôle n'est pas affichée", () => {
    const shared = highlight(1, 1, { votesFunny: 2 });
    const picked = pickReviewHighlights({ funny: [shared], helpful: [{ ...shared }, highlight(2, 2)] }, 5);

    expect(picked.funny).toBeNull();
    expect(picked.helpful?.recommendationId).toBe(1);
  });

  it("n'élit pas une review drôle qui n'a pas fait rire cinq personnes", () => {
    const picked = pickReviewHighlights({ funny: [highlight(1, 1, { votesFunny: 4 })], helpful: [] }, 5);

    expect(picked.funny).toBeNull();
  });

  it("juge la plus utile sur ses votes « utile », après déduplication", () => {
    const shared = highlight(1, 1);
    const picked = pickReviewHighlights(
      { funny: [shared], helpful: [{ ...shared }, highlight(2, 2, { votesUp: 3 })] },
      5,
    );

    expect(picked.helpful).toBeNull();
  });

  it("ne sacre personne quand une catégorie est vide", () => {
    expect(pickReviewHighlights({ funny: [], helpful: [] }, 5)).toEqual({ funny: null, helpful: null });
  });
});

describe("buildAwards", () => {
  it("range les récompenses dans l'ordre du carrousel", () => {
    const awards = buildAwards(sources(), THRESHOLDS);

    expect(awards.map((award) => award.id)).toEqual([
      "best-of-week",
      "comeback",
      "freefall",
      "most-reviewed",
      "funniest-review",
      "most-helpful-review",
      "best-of-year",
      "most-hated",
      "hidden-gem",
      "nobody-agrees",
    ]);
  });

  it("ouvre sur le gagnant de la semaine, sa part positive et sa citation", () => {
    const [best] = buildAwards(sources(), THRESHOLDS);

    expect(best).toMatchObject({
      chip: "Best of the week",
      label: "best of last 7 days",
      range: "07 Sep – 13 Sep",
      appId: 1,
      name: "Week winner",
      figure: "96%",
      figureColor: "var(--status-good)",
      meta: "1,234 reviews in the last 7 days",
      quote: "Best [b]thing[/b] all year.",
      layout: "game",
    });
    expect(best.hint).toContain("at least 100 reviews");
  });

  it("dit dans la puce et le kicker que le podium s'est replié sur trente jours", () => {
    const [best] = buildAwards(
      sources({ podium: { window: ranked([windowed(1, "Month winner", 0.95)]), days: 30, minReviews: 500 }, quotes: {} }),
      THRESHOLDS,
    );

    expect(best.chip).toBe("Best of the month");
    expect(best.label).toBe("best of last 30 days");
    expect(best.hint).toContain("at least 500 reviews");
    expect(best.quote).toBeUndefined();
  });

  it("montre le retour en grâce en points, et d'où il part", () => {
    const comeback = buildAwards(sources(), THRESHOLDS).find((award) => award.id === "comeback");

    expect(comeback?.figure).toBe("+18 pts");
    expect(comeback?.figureColor).toBe("var(--status-good)");
    expect(comeback?.meta).toContain("62% → 80%");
  });

  it("montre la chute avec un vrai signe moins", () => {
    const freefall = buildAwards(sources(), THRESHOLDS).find((award) => award.id === "freefall");

    expect(freefall?.figure).toBe("−24 pts");
    expect(freefall?.figureColor).toBe("var(--status-critical)");
    expect(freefall?.meta).toContain("80% → 56%");
  });

  it("cache le comeback et la chute quand l'écart n'a pas le bon signe", () => {
    const awards = buildAwards(
      sources({ movers: { up: mover(3, 0.8, 0.7), down: mover(4, 0.5, 0.6) } }),
      THRESHOLDS,
    );

    expect(awards.map((award) => award.id)).not.toContain("comeback");
    expect(awards.map((award) => award.id)).not.toContain("freefall");
  });

  it("cache chaque récompense dont la requête n'a rien rendu", () => {
    const awards = buildAwards(
      sources({
        podium: { window: ranked([]), days: 30, minReviews: 500 },
        movers: { up: null, down: null },
        mostReviewed: ranked([]),
        reviews: { funny: [], helpful: [] },
        year: ranked([]),
        hated: ranked([]),
        hiddenGem: ranked([]),
      }),
      THRESHOLDS,
    );

    expect(awards.map((award) => award.id)).toEqual(["nobody-agrees"]);
  });

  it("rend un carrousel vide plutôt que de planter quand tout manque", () => {
    const awards = buildAwards(
      sources({
        podium: { window: ranked([]), days: 30, minReviews: 500 },
        movers: { up: null, down: null },
        mostReviewed: ranked([]),
        reviews: { funny: [], helpful: [] },
        year: ranked([]),
        hated: ranked([]),
        hiddenGem: ranked([]),
        polarised: [],
      }),
      THRESHOLDS,
    );

    expect(awards).toEqual([]);
  });

  it("annonce le jeu le plus commenté par son nombre d'avis", () => {
    const busy = buildAwards(sources(), THRESHOLDS).find((award) => award.id === "most-reviewed");

    expect(busy?.figure).toBe("12,043");
    expect(busy?.figureLabel).toBe("reviews");
    expect(busy?.meta).toBe("84% positive in the last 7 days");
  });

  it("fait de la review la plus drôle une diapositive de citation", () => {
    const funny = buildAwards(sources(), THRESHOLDS).find((award) => award.id === "funniest-review");

    expect(funny).toMatchObject({
      layout: "review",
      chip: "Funniest review",
      label: "funniest review · last 30 days",
      range: "15 Aug – 13 Sep",
      name: "Game 1",
      appId: 101,
      figure: "42",
      figureLabel: "found it funny",
      meta: "by author1 · 13 hrs at review",
      quote: "Review 1",
    });
  });

  it("compte les votes « utile » sur la review la plus utile", () => {
    const helpful = buildAwards(sources(), THRESHOLDS).find((award) => award.id === "most-helpful-review");

    expect(helpful?.figure).toBe("310");
    expect(helpful?.figureLabel).toBe("found it helpful");
  });

  it("titre le meilleur de l'année sur l'année de la fenêtre", () => {
    const year = buildAwards(sources(), THRESHOLDS).find((award) => award.id === "best-of-year");

    expect(year?.chip).toBe("Best of 2026");
    expect(year?.label).toBe("best of 2026 · year to date");
    expect(year?.hint).toContain("at least 1,000 reviews");
  });

  it("colore le jeu le plus détesté selon son verdict", () => {
    const hated = buildAwards(sources(), THRESHOLDS).find((award) => award.id === "most-hated");

    expect(hated?.figure).toBe("12%");
    expect(hated?.figureColor).toBe("var(--status-critical)");
  });

  it("rappelle que la pépite cachée est peu commentée sur Steam", () => {
    const gem = buildAwards(sources(), THRESHOLDS).find((award) => award.id === "hidden-gem");

    expect(gem?.meta).toBe("64 reviews in the last 30 days · 1,500 on Steam overall");
    expect(gem?.hint).toContain("fewer than 2,000");
  });

  it("présente le jeu le plus clivant sur son score de toujours", () => {
    const divisive = buildAwards(sources(), THRESHOLDS).find((award) => award.id === "nobody-agrees");

    expect(divisive).toMatchObject({ name: "Divisive", figure: "51%", range: null, meta: "52,000 reviews · all time" });
  });

  it("coupe les citations trop longues avant de les embarquer", () => {
    const long = `${"word ".repeat(200)}end`;
    const awards = buildAwards(
      sources({ reviews: { funny: [highlight(1, 1, { reviewText: long })], helpful: [] } }),
      THRESHOLDS,
    );

    expect(awards.find((award) => award.id === "funniest-review")?.quote?.endsWith("…")).toBe(true);
  });

  it("cite une review sous chaque récompense qui en a une", () => {
    const quotes = Object.fromEntries(
      buildAwards(sources(), THRESHOLDS).map((award) => [award.id, award.quote]),
    );

    expect(quotes).toMatchObject({
      "best-of-week": "Best [b]thing[/b] all year.",
      comeback: "They fixed it.",
      freefall: "They broke it.",
      "most-reviewed": "Everyone is playing this.",
      "best-of-year": "Nothing came close this year.",
      "most-hated": "Do not buy.",
      "hidden-gem": "Nobody knows this one yet.",
      "nobody-agrees": "Half of us love it.",
    });
  });

  it("laisse sans citation la récompense dont la review manque", () => {
    const awards = buildAwards(sources({ quotes: { comeback: "They fixed it." } }), THRESHOLDS);

    expect(awards.find((award) => award.id === "comeback")?.quote).toBe("They fixed it.");
    expect(awards.find((award) => award.id === "freefall")?.quote).toBeUndefined();
    expect(awards.find((award) => award.id === "most-hated")?.quote).toBeUndefined();
  });

  it("ignore une citation qui n'est que du blanc", () => {
    const awards = buildAwards(sources({ quotes: { "hidden-gem": "   " } }), THRESHOLDS);

    expect(awards.find((award) => award.id === "hidden-gem")?.quote).toBeUndefined();
  });

  it("coupe une citation de récompense trop longue, comme celles des reviews primées", () => {
    const awards = buildAwards(sources({ quotes: { "most-hated": `${"word ".repeat(200)}end` } }), THRESHOLDS);

    expect(awards.find((award) => award.id === "most-hated")?.quote?.endsWith("…")).toBe(true);
  });

  it("laisse l'illustration vide : la page la résout après coup", () => {
    expect(buildAwards(sources(), THRESHOLDS).every((award) => award.art === null)).toBe(true);
  });
});
