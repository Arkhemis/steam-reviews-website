import { describe, expect, it } from "vitest";
import { battleHref, languageFromAcceptLanguage, resolveLanguage, resolveMatchup } from "@/lib/battle";

describe("resolveMatchup", () => {
  it("n'oppose jamais un jeu à lui-même", () => {
    expect(resolveMatchup("1086940", "1086940")).toEqual({ leftAppId: 1086940, rightAppId: 1716740 });
    expect(resolveMatchup("570", "570")).toEqual({ leftAppId: 570, rightAppId: 1086940 });
  });

  it("retombe sur la paire par défaut sans paramètres", () => {
    expect(resolveMatchup()).toEqual({ leftAppId: 1086940, rightAppId: 1716740 });
  });
});

describe("battleHref", () => {
  it("pointe vers /battle", () => {
    expect(battleHref(570, 730)).toBe("/battle?game=570&vs=730");
  });

  it("écrit toute langue donnée, anglais compris, pour qu'elle l'emporte sur le navigateur", () => {
    expect(battleHref(570, 730, "english")).toBe("/battle?game=570&vs=730&lang=english");
    expect(battleHref(570, 730, "french")).toBe("/battle?game=570&vs=730&lang=french");
  });
});

describe("resolveLanguage", () => {
  it("ramène une langue inconnue à l'anglais", () => {
    expect(resolveLanguage("french")).toBe("french");
    expect(resolveLanguage("klingon")).toBe("english");
    expect(resolveLanguage(undefined)).toBe("english");
  });
});

describe("languageFromAcceptLanguage", () => {
  it("prend la langue préférée reconnue", () => {
    expect(languageFromAcceptLanguage("fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7")).toBe("french");
    expect(languageFromAcceptLanguage("de")).toBe("german");
  });

  it("respecte les poids q plutôt que l'ordre d'écriture", () => {
    expect(languageFromAcceptLanguage("en;q=0.5,ja;q=0.9")).toBe("japanese");
  });

  it("saute les langues que Steam ne connaît pas", () => {
    expect(languageFromAcceptLanguage("eu-ES,ca;q=0.9,es;q=0.8")).toBe("spanish");
  });

  it("distingue les variantes régionales", () => {
    expect(languageFromAcceptLanguage("pt-BR")).toBe("brazilian");
    expect(languageFromAcceptLanguage("pt-PT")).toBe("portuguese");
    expect(languageFromAcceptLanguage("es-MX")).toBe("latam");
    expect(languageFromAcceptLanguage("es-419")).toBe("latam");
    expect(languageFromAcceptLanguage("es-ES")).toBe("spanish");
    expect(languageFromAcceptLanguage("zh-TW")).toBe("tchinese");
    expect(languageFromAcceptLanguage("zh-Hant-HK")).toBe("tchinese");
    expect(languageFromAcceptLanguage("zh-CN")).toBe("schinese");
    expect(languageFromAcceptLanguage("nb-NO")).toBe("norwegian");
    expect(languageFromAcceptLanguage("ko-KR")).toBe("koreana");
  });

  it("rend null sans langue reconnue", () => {
    expect(languageFromAcceptLanguage(undefined)).toBeNull();
    expect(languageFromAcceptLanguage("")).toBeNull();
    expect(languageFromAcceptLanguage("*")).toBeNull();
    expect(languageFromAcceptLanguage("eu,ca")).toBeNull();
  });
});
