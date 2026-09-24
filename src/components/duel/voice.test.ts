import { describe, expect, it } from "vitest";
import { chunkText, quoteParts, speechPitch } from "@/components/duel/voice";
import { autoSpeed, normalize, trimSilence } from "@/components/duel/voiceFx";

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

describe("speechPitch", () => {
  it("garde la hauteur normale", () => {
    expect(speechPitch(1)).toBe(1);
  });

  it("reste dans les bornes de Web Speech", () => {
    expect(speechPitch(0.4)).toBe(0);
    expect(speechPitch(2)).toBe(2);
  });

  it("monte et descend autour de la normale", () => {
    expect(speechPitch(0.8)).toBeLessThan(1);
    expect(speechPitch(1.2)).toBeGreaterThan(1);
  });
});

describe("normalize", () => {
  const rms = (samples: Float32Array) => Math.sqrt(samples.reduce((sum, s) => sum + s * s, 0) / samples.length);
  const sine = (amplitude: number) => Float32Array.from({ length: 4410 }, (_, i) => amplitude * Math.sin(i / 5));

  it("amène une voix trop basse et une trop forte au même niveau", () => {
    const quiet = rms(normalize(sine(0.08)));
    const loud = rms(normalize(sine(0.6)));
    expect(Math.abs(quiet - loud)).toBeLessThan(0.01);
  });

  it("ne dépasse jamais la pleine échelle", () => {
    const out = normalize(Float32Array.from([0.02, 0.02, 0.02, 0.9, -0.9]));
    expect(out.every((s) => Math.abs(s) <= 1)).toBe(true);
  });

  it("laisse un silence intact", () => {
    expect([...normalize(new Float32Array(10))]).toEqual(new Array(10).fill(0));
  });
});

describe("trimSilence", () => {
  it("coupe le souffle de tête et de fin, en gardant la parole et une petite marge", () => {
    const rate = 1000;
    // 100 ms de souffle faible, 100 ms de parole, 100 ms de traîne faible.
    const samples = Float32Array.from({ length: 300 }, (_, i) => (i >= 100 && i < 200 ? 0.5 : 0.005));
    const out = trimSilence(samples, rate);
    expect(out.filter((s) => s === 0.5).length).toBe(100);
    expect(out.length).toBeLessThanOrEqual(100 + 10 + 20);
  });

  it("garde une consonne douce en tête de mot", () => {
    const rate = 1000;
    // Un « f » à -24 dB sous la voix, précédé de souffle à -42 dB.
    const samples = Float32Array.from({ length: 300 }, (_, i) => (i < 50 ? 0.00390625 : i < 100 ? 0.03125 : 0.5));
    expect(trimSilence(samples, rate).filter((s) => s === 0.03125).length).toBe(50);
  });
});

describe("quoteParts", () => {
  it("ralentit les gros mots quand la réplique n'est pas censurée", () => {
    expect(quoteParts("this shit rocks", "english", false)).toEqual([
      { text: "this ", swear: false },
      { text: "shit", swear: true },
      { text: " rocks", swear: false },
    ]);
  });

  it("bipe tous les gros mots quand elle l'est, cœurs comme mots en clair", () => {
    expect(quoteParts("fucking ♥♥♥♥ game", "english", true)).toEqual([null, { text: " ", swear: false }, null, { text: " game", swear: false }]);
  });
});
