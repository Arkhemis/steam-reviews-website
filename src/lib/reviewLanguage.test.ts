import { describe, expect, it } from "vitest";
import { ALL_LANGUAGES, resolveReviewLanguage } from "@/lib/reviewLanguage";
import type { GameReviewLanguage } from "@/lib/data/types";

function available(...entries: [string, number][]): GameReviewLanguage[] {
  return entries.map(([language, reviewCount]) => ({ language, reviewCount }));
}

describe("resolveReviewLanguage", () => {
  it("defaults to english when no language is requested", () => {
    expect(resolveReviewLanguage(available(["schinese", 60], ["english", 40]), undefined)).toBe("english");
  });

  it("falls back to the best-represented language when the game has no english reviews", () => {
    expect(resolveReviewLanguage(available(["schinese", 60], ["french", 40]), undefined)).toBe("schinese");
  });

  it("honours a requested language the game actually has", () => {
    expect(resolveReviewLanguage(available(["english", 60], ["french", 40]), "french")).toBe("french");
  });

  it("falls back when the requested language has no reviews for this game", () => {
    expect(resolveReviewLanguage(available(["english", 60], ["french", 40]), "thai")).toBe("english");
  });

  it("returns null for the all-languages selection so the query stays unfiltered", () => {
    expect(resolveReviewLanguage(available(["english", 60]), ALL_LANGUAGES)).toBeNull();
  });

  it("returns null when the game has no highlighted reviews at all", () => {
    expect(resolveReviewLanguage([], undefined)).toBeNull();
  });
});
