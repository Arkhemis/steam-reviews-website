import { describe, expect, it } from "vitest";
import { chunkText } from "@/components/duel/voice";
import { autoSpeed } from "@/components/duel/voiceFx";

describe("chunkText", () => {
  it("laisse entier un texte qui tient", () => {
    expect(chunkText("Ten out of ten.", 200)).toEqual(["Ten out of ten."]);
  });

  it("coupe entre deux mots, sans dépasser la limite", () => {
    const text = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
    const chunks = chunkText(text, 50);
    expect(chunks.every((chunk) => chunk.length <= 50)).toBe(true);
    expect(chunks.join(" ")).toBe(text);
  });

  it("coupe net un texte sans espace (chinois, japonais)", () => {
    expect(chunkText("好".repeat(250), 200).map((chunk) => chunk.length)).toEqual([200, 50]);
  });
});

describe("autoSpeed", () => {
  it("garde la vitesse normale sous le seuil", () => {
    expect(autoSpeed(3, 4, 1.8)).toBe(1);
  });

  it("accélère au prorata au-delà du seuil", () => {
    expect(autoSpeed(6, 4, 1.8)).toBe(1.5);
  });

  it("lit les répliques courtes à la vitesse de base", () => {
    expect(autoSpeed(2, 4, 1.8, 1.15)).toBe(1.15);
  });

  it("plafonne l'accélération", () => {
    expect(autoSpeed(20, 4, 1.8)).toBe(1.8);
  });
});
