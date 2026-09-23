import { describe, expect, it } from "vitest";
import { battleHref, resolveMatchup } from "@/lib/battle";

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
});
