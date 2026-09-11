import { describe, expect, it } from "vitest";
import { formatReviewWindow } from "@/lib/reviewWindow";

describe("formatReviewWindow", () => {
  it("place le jour avant le mois, abrégé comme en en-US", () => {
    expect(formatReviewWindow("2026-09-07", "2026-09-13")).toBe("07 Sep – 13 Sep");
  });

  it("garde l'abréviation à trois lettres, pas le « Sept » britannique", () => {
    expect(formatReviewWindow("2026-09-01", "2026-09-30")).not.toContain("Sept ");
  });

  it("traverse un changement de mois", () => {
    expect(formatReviewWindow("2026-08-31", "2026-09-06")).toBe("31 Aug – 06 Sep");
  });

  // Les dates arrivent en ISO nu : lues dans le fuseau local, elles reculeraient
  // d'un jour à l'ouest de Greenwich.
  it("ne recule pas d'un jour selon le fuseau", () => {
    expect(formatReviewWindow("2026-01-01", "2026-01-01")).toBe("01 Jan – 01 Jan");
  });

  it("ne rend rien quand une borne manque", () => {
    expect(formatReviewWindow(null, "2026-09-13")).toBeNull();
    expect(formatReviewWindow("2026-09-07", null)).toBeNull();
  });
});
