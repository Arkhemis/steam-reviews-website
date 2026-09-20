import { describe, expect, it } from "vitest";
import { cataloguePageQuery } from "@/lib/data/gameData";
import { RANKINGS, RANKING_SHELVES, isRankingKey, ranking } from "@/lib/rankings";

// Le défaut d'origine : la rangée « Hidden gems » ne montrait que des jeux
// adorés et confidentiels, mais son « see all » renvoyait vers `best-rated`,
// qui n'applique ni le plafond de volume ni le plancher de score. Le lecteur
// cliquait pour voir la suite d'une liste et tombait sur une autre.
describe("une rangée et son « see all » servent la même liste", () => {
  it("renvoie chaque rangée vers un filtre qui existe", () => {
    for (const entry of RANKING_SHELVES) {
      expect(isRankingKey(entry.key), entry.key).toBe(true);
    }
  });

  // L'égalité est celle de l'objet : la rangée et la grille derrière son lien
  // lisent la même entrée de `RANKINGS`, donc les mêmes bornes.
  it("fait lire à la grille le classement même de la rangée", () => {
    for (const entry of RANKING_SHELVES) {
      expect(ranking(entry.key), entry.key).toBe(entry);
    }
  });

  // La preuve par le SQL : la requête de « Hidden gems » porte son plafond de
  // volume et son plancher de score, là où `best-rated` n'en a aucun.
  it("emporte les bornes de la rangée jusque dans la requête", () => {
    const gem = cataloguePageQuery({ sort: "hidden-gem", limit: 24 });
    const bestRated = cataloguePageQuery({ sort: "best-rated", limit: 24 });

    expect(gem.values).toContain(200_000);
    expect(gem.values).toContain(95);
    expect(bestRated.values).not.toContain(200_000);
    expect(bestRated.values).not.toContain(95);
  });

  it("garde le même ORDER BY que le classement qu'elle prolonge", () => {
    const gem = cataloguePageQuery({ sort: "hidden-gem", limit: 24 });

    expect(gem.text).toContain("pct_positive_reviews DESC");
  });
});

describe("Most despised", () => {
  it("existe, et se range juste après Hidden gems", () => {
    expect(RANKING_SHELVES.map((r) => r.key)).toEqual([
      "hidden-gem",
      "most-despised",
      "recent",
      "polarised",
    ]);
  });

  // Au plancher de `worst-rated`, la rangée ne montrerait que des jeux à douze
  // avis tombés à 3 % par accident. On veut des jeux vraiment détestés, ce qui
  // suppose assez de monde pour le dire.
  it("exige bien plus de volume que « Worst rated »", () => {
    expect(ranking("most-despised").minReviews).toBeGreaterThan(ranking("worst-rated").minReviews);
  });

  it("classe par le bas du score", () => {
    expect(cataloguePageQuery({ sort: "most-despised", limit: 24 }).text).toContain(
      "pct_positive_reviews ASC",
    );
  });
});

describe("RANKINGS", () => {
  it("nomme chaque classement une seule fois", () => {
    const keys = RANKINGS.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("donne à chacun un libellé et une règle", () => {
    for (const entry of RANKINGS) {
      expect(entry.label, entry.key).not.toBe("");
      expect(entry.note, entry.key).not.toBe("");
    }
  });

  // Un classement au score ne veut rien dire à faible volume : à douze avis,
  // un jeu tombe à 100 % ou à 0 % par accident. Seuls les tris au volume ou à
  // la date peuvent s'en passer.
  it("exige du volume de tout classement qui juge un score", () => {
    const auVolume = ["most-reviewed", "recent"];
    for (const entry of RANKINGS) {
      if (auVolume.includes(entry.key)) continue;
      expect(entry.minReviews, entry.key).toBeGreaterThan(1);
    }
  });

  // Les deux classements au score sont l'exact miroir l'un de l'autre : un
  // seuil différent ferait juger les deux bouts du catalogue à des barres
  // différentes.
  it("juge les deux bouts du catalogue au même seuil", () => {
    expect(ranking("worst-rated").minReviews).toBe(ranking("best-rated").minReviews);
  });
});

describe("isRankingKey", () => {
  // La valeur vient de la query string : n'importe quoi peut arriver, et la
  // page doit retomber sur son tri par défaut plutôt que d'interpoler une clé
  // inconnue dans son ORDER BY.
  it("rejette ce qui n'est pas une clé connue", () => {
    expect(isRankingKey(undefined)).toBe(false);
    expect(isRankingKey("Most-Despised")).toBe(false);
    expect(isRankingKey("pct_positive_reviews ASC; DROP TABLE marts.game_stats")).toBe(false);
  });
});

describe("ranking", () => {
  it("retombe sur le tri par défaut pour une clé inconnue", () => {
    // @ts-expect-error — c'est justement ce que la query string peut envoyer.
    expect(ranking("nawak").key).toBe(RANKINGS[0].key);
  });
});
