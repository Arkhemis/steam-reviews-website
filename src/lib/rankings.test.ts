import { describe, expect, it } from "vitest";
import {
  AWARD_IDS,
  RANKINGS,
  RANKING_SHELVES,
  REVIEW_AWARDS,
  isRankingKey,
  ranking,
} from "@/lib/rankings";

// Le point de départ de ce module : la home primait « Most hated » sans que
// `/charts` sache le classer, parce que les deux pages tenaient deux listes
// indépendantes. Ces tests sont là pour que ça ne puisse plus arriver en
// silence — ajouter une récompense sans son classement casse la suite.
describe("couverture de la vitrine", () => {
  const classables = AWARD_IDS.filter(
    (id) => !(REVIEW_AWARDS as readonly string[]).includes(id),
  );

  it("donne un classement à chaque récompense qui prime un jeu", () => {
    const couvertes = RANKINGS.flatMap((r) => (r.award ? [r.award] : []));
    expect([...classables].sort()).toEqual([...couvertes].sort());
  });

  it("donne une rubrique à chaque récompense qui prime un jeu", () => {
    const enRubrique = RANKING_SHELVES.flatMap((r) => (r.award ? [r.award] : []));
    expect([...classables].sort()).toEqual([...enRubrique].sort());
  });

  // Les deux récompenses de review priment un texte : une rangée de jaquettes
  // n'en dirait rien. L'exclusion doit rester explicite, pas devenir un oubli.
  it("laisse les reviews primées hors des classements, et le dit", () => {
    expect(REVIEW_AWARDS).toEqual(["funniest-review", "most-helpful-review"]);
    for (const id of REVIEW_AWARDS) {
      expect(AWARD_IDS).toContain(id);
      expect(RANKINGS.some((r) => r.award === id)).toBe(false);
    }
  });

  it("ne prolonge jamais deux fois la même récompense", () => {
    const awards = RANKINGS.flatMap((r) => (r.award ? [r.award] : []));
    expect(new Set(awards).size).toBe(awards.length);
  });
});

describe("RANKINGS", () => {
  it("nomme chaque classement une seule fois", () => {
    const keys = RANKINGS.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("donne à chacun un libellé et une règle", () => {
    for (const entry of RANKINGS) {
      expect(entry.label).not.toBe("");
      expect(entry.note).not.toBe("");
    }
  });

  // Un classement au score ne veut rien dire à faible volume : à douze avis,
  // un jeu tombe à 100 % ou à 0 % par accident. Seuls les tris au volume ou à
  // la date peuvent s'en passer.
  it("exige du volume de tout classement qui juge un score", () => {
    const auVolume = ["most-reviewed", "most-reviewed-week", "recent"];
    for (const entry of RANKINGS) {
      if (auVolume.includes(entry.key)) continue;
      expect(entry.minReviews, entry.key).toBeGreaterThan(1);
    }
  });

  // « Comeback » et « Freefall » sont les deux bouts du même classement, comme
  // « Best rated » et « Worst rated » : un seuil différent jugerait les deux
  // extrémités du catalogue à des barres différentes.
  it("juge les deux bouts d'un même classement au même seuil", () => {
    expect(ranking("freefall").minReviews).toBe(ranking("comeback").minReviews);
    expect(ranking("worst-rated").minReviews).toBe(ranking("best-rated").minReviews);
  });

  it("ne lit une fenêtre précédente que pour les deux fenêtres qui en ont une", () => {
    for (const entry of RANKINGS) {
      if (entry.source.kind !== "movers") continue;
      expect(["week", "month"], entry.key).toContain(entry.source.window);
    }
  });
});

describe("RANKING_SHELVES", () => {
  it("ne retient que des classements qui ont une rubrique", () => {
    for (const entry of RANKING_SHELVES) {
      expect(entry.shelf.title, entry.key).not.toBe("");
      expect(entry.shelf.note, entry.key).not.toBe("");
    }
  });

  // Chaque rubrique porte un « see all » vers son propre classement : une
  // rubrique dont la clé ne serait pas un filtre renverrait le lecteur sur le
  // tri par défaut, sans rapport avec ce qu'il vient de lire.
  it("renvoie chaque rubrique vers un filtre qui existe", () => {
    for (const entry of RANKING_SHELVES) {
      expect(isRankingKey(entry.key), entry.key).toBe(true);
    }
  });

  it("suit l'ordre du carrousel de la home", () => {
    expect(RANKING_SHELVES.map((r) => r.key)).toEqual([
      "best-of-week",
      "comeback",
      "freefall",
      "most-reviewed-week",
      "best-of-year",
      "most-hated",
      "hidden-gem",
      "polarised",
      "recent",
    ]);
  });
});

describe("isRankingKey", () => {
  // La valeur vient de la query string : n'importe quoi peut arriver, et la
  // page doit retomber sur son tri par défaut plutôt que d'interpoler une clé
  // inconnue dans son ORDER BY.
  it("rejette ce qui n'est pas une clé connue", () => {
    expect(isRankingKey(undefined)).toBe(false);
    expect(isRankingKey("Most-Hated")).toBe(false);
    expect(isRankingKey("pct_positive DESC; DROP TABLE marts.game_stats")).toBe(false);
  });
});

describe("ranking", () => {
  it("retombe sur le tri par défaut pour une clé inconnue", () => {
    // @ts-expect-error — c'est justement ce que la query string peut envoyer.
    expect(ranking("nawak").key).toBe(RANKINGS[0].key);
  });
});
