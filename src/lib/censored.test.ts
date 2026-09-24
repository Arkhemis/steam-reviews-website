import { describe, expect, it } from "vitest";
import { insultFor, splitCensored, splitSwears, SWEARS, uncensor } from "@/lib/censored";

describe("splitCensored", () => {
  it("remplace chaque série de cœurs par un gros mot de la langue", () => {
    expect(splitCensored("Chapter 7 is truly ♥♥♥♥♥, not fun.", "french")).toEqual([
      { text: "Chapter 7 is truly ", censored: false },
      { text: "merde", censored: true, hearts: "♥♥♥♥♥" },
      { text: ", not fun.", censored: false },
    ]);
  });

  it("gère plusieurs séries, y compris en début et en fin de texte", () => {
    expect(splitCensored("♥♥♥♥ and ♥♥♥♥♥♥♥", "german")).toEqual([
      { text: "Mist", censored: true, hearts: "♥♥♥♥" },
      { text: " and ", censored: false },
      { text: "Scheiße", censored: true, hearts: "♥♥♥♥♥♥♥" },
    ]);
  });

  it("traite les gros mots laissés en clair comme ceux que Steam a censurés", () => {
    expect(splitCensored("Rockstar ain't cooking shit", "english")).toEqual([
      { text: "Rockstar ain't cooking ", censored: false },
      { text: "shit", censored: true, hearts: "♥♥♥♥" },
    ]);
  });

  it("laisse un texte sans cœurs intact", () => {
    expect(splitCensored("Great game", "english")).toEqual([{ text: "Great game", censored: false }]);
  });
});

describe("insultFor", () => {
  it("prend le gros mot qui a autant de lettres que de cœurs", () => {
    expect(insultFor("english", "♥♥♥♥♥♥♥")).toBe("fucking");
    expect(insultFor("english", "♥♥♥♥♥♥♥♥")).toBe("bullshit");
  });

  it("à défaut, prend le plus proche en longueur", () => {
    expect(insultFor("english", "♥".repeat(20))).toBe("motherfucker");
  });

  it("retombe sur l'anglais pour une langue inconnue", () => {
    expect(insultFor("klingon")).toBe("shit");
  });

  it("propose plusieurs gros mots pour chaque langue", () => {
    expect(Object.values(SWEARS).every((swears) => swears.length >= 5)).toBe(true);
  });
});

describe("uncensor", () => {
  it("rend un texte lisible à voix haute", () => {
    expect(uncensor("truly ♥♥♥♥♥♥!", "spanish")).toBe("truly mierda!");
  });
});

describe("splitSwears", () => {
  it("isole les gros mots écrits en clair", () => {
    expect(splitSwears("Rockstar ain't cooking shit", "english")).toEqual([
      { text: "Rockstar ain't cooking ", swear: false },
      { text: "shit", swear: true },
    ]);
  });

  it("marque les cœurs remplacés", () => {
    expect(splitSwears("they ♥♥♥♥♥♥♥ nerfed it", "english")).toEqual([
      { text: "they ", swear: false },
      { text: "fucking", swear: true },
      { text: " nerfed it", swear: false },
    ]);
  });

  it("ne voit pas de gros mot au milieu d'un mot", () => {
    expect(splitSwears("A classic, passable", "english")).toEqual([{ text: "A classic, passable", swear: false }]);
  });

  it("reconnaît les jurons anglais dans une review d'une autre langue", () => {
    expect(splitSwears("Ce jeu est de la merde, bullshit total", "french").filter((s) => s.swear)).toEqual([
      { text: "merde", swear: true },
      { text: "bullshit", swear: true },
    ]);
  });

  it("cherche partout dans les langues sans espaces", () => {
    expect(splitSwears("这是狗屎游戏", "schinese")).toEqual([
      { text: "这是", swear: false },
      { text: "狗屎", swear: true },
      { text: "游戏", swear: false },
    ]);
  });

  it("ne voit pas de juron anglais au milieu d'un mot latin, même sans espaces", () => {
    expect(splitSwears("这是classic游戏", "schinese")).toEqual([{ text: "这是classic游戏", swear: false }]);
    expect(splitSwears("这是shit游戏", "schinese")).toEqual([
      { text: "这是", swear: false },
      { text: "shit", swear: true },
      { text: "游戏", swear: false },
    ]);
  });
});
