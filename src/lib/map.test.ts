import { describe, expect, it } from "vitest";
import { COUNTRY_LANGUAGE, FALLBACK_COLOR, getCountryScoreColor, LANGUAGE_LABELS, scoreToColor } from "@/lib/map";

describe("scoreToColor", () => {
  it("returns the critical red at 0", () => {
    expect(scoreToColor(0)).toBe("#d03b3b");
  });

  it("returns the warning yellow at 0.5", () => {
    expect(scoreToColor(0.5)).toBe("#fab219");
  });

  it("returns the good green at 1", () => {
    expect(scoreToColor(1)).toBe("#0ca30c");
  });

  it("interpolates between red and yellow below 0.5", () => {
    const color = scoreToColor(0.25);
    expect(color).not.toBe("#d03b3b");
    expect(color).not.toBe("#fab219");
  });

  it("clamps out-of-range values", () => {
    expect(scoreToColor(-0.4)).toBe("#d03b3b");
    expect(scoreToColor(1.4)).toBe("#0ca30c");
  });
});

describe("COUNTRY_LANGUAGE", () => {
  it("maps Francophone African countries to french", () => {
    expect(COUNTRY_LANGUAGE["450"]).toBe("french"); // Madagascar
    expect(COUNTRY_LANGUAGE["686"]).toBe("french"); // Senegal
    expect(COUNTRY_LANGUAGE["180"]).toBe("french"); // Dem. Rep. Congo
  });

  it("maps Anglophone African/Caribbean/Pacific countries to english", () => {
    expect(COUNTRY_LANGUAGE["566"]).toBe("english"); // Nigeria
    expect(COUNTRY_LANGUAGE["404"]).toBe("english"); // Kenya
  });

  it("distinguishes Spain (spanish) from Latin America (latam)", () => {
    expect(COUNTRY_LANGUAGE["724"]).toBe("spanish"); // Spain
    expect(COUNTRY_LANGUAGE["032"]).toBe("latam"); // Argentina
    expect(COUNTRY_LANGUAGE["484"]).toBe("latam"); // Mexico
  });

  it("distinguishes Taiwan (tchinese) from China (schinese)", () => {
    expect(COUNTRY_LANGUAGE["158"]).toBe("tchinese");
    expect(COUNTRY_LANGUAGE["156"]).toBe("schinese");
  });

  it("leaves politically contested language splits unmapped", () => {
    expect(COUNTRY_LANGUAGE["196"]).toBeUndefined(); // Cyprus
    expect(COUNTRY_LANGUAGE["804"]).toBeUndefined(); // Ukraine
  });
});

describe("LANGUAGE_LABELS", () => {
  it("has a French display label for every Steam language code", () => {
    for (const code of ["english", "french", "german", "spanish", "latam", "schinese", "tchinese", "brazilian", "portuguese"]) {
      expect(LANGUAGE_LABELS[code as keyof typeof LANGUAGE_LABELS]).toBeTruthy();
    }
  });
});

describe("getCountryScoreColor", () => {
  it("colors a mapped country by its language's score", () => {
    expect(getCountryScoreColor("250", { french: 1 })).toBe(scoreToColor(1)); // France
  });

  it("falls back to the neutral color for an unmapped country", () => {
    expect(getCountryScoreColor("999", { french: 1 })).toBe(FALLBACK_COLOR);
  });

  it("falls back to the neutral color when the mapped language has no score", () => {
    expect(getCountryScoreColor("250", { german: 0.8 })).toBe(FALLBACK_COLOR);
  });
});
