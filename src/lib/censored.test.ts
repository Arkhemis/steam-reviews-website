import { describe, expect, it } from "vitest";
import { insultFor, splitCensored, uncensor } from "@/lib/censored";

describe("splitCensored", () => {
  it("remplace chaque série de cœurs par l'insulte de la langue", () => {
    expect(splitCensored("Chapter 7 is truly ♥♥♥♥, not fun.", "french")).toEqual([
      { text: "Chapter 7 is truly ", censored: false },
      { text: "merde", censored: true, hearts: "♥♥♥♥" },
      { text: ", not fun.", censored: false },
    ]);
  });

  it("gère plusieurs séries, y compris en début et en fin de texte", () => {
    expect(splitCensored("♥♥ and ♥♥♥", "german")).toEqual([
      { text: "Scheiße", censored: true, hearts: "♥♥" },
      { text: " and ", censored: false },
      { text: "Scheiße", censored: true, hearts: "♥♥♥" },
    ]);
  });

  it("laisse un texte sans cœurs intact", () => {
    expect(splitCensored("Great game", "english")).toEqual([{ text: "Great game", censored: false }]);
  });
});

describe("insultFor", () => {
  it("retombe sur l'anglais pour une langue inconnue", () => {
    expect(insultFor("klingon")).toBe("shit");
  });
});

describe("uncensor", () => {
  it("rend un texte lisible à voix haute", () => {
    expect(uncensor("truly ♥♥♥♥!", "spanish")).toBe("truly mierda!");
  });
});
