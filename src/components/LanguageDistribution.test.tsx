import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LanguageDistribution } from "@/components/LanguageDistribution";
import type { GameLanguageDistribution } from "@/lib/data/types";

const languages: GameLanguageDistribution[] = [
  { appId: 1, language: "english", reviewCount: 500, pctOfTotal: 0.5 },
  { appId: 1, language: "french", reviewCount: 300, pctOfTotal: 0.3 },
  { appId: 1, language: "german", reviewCount: 200, pctOfTotal: 0.2 },
];

describe("LanguageDistribution", () => {
  it("renders a bar and legend entry per language", () => {
    render(<LanguageDistribution languages={languages} />);
    expect(screen.getAllByText("english").length).toBeGreaterThan(0);
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("folds languages beyond the top 6 into an Autres bucket", () => {
    const many: GameLanguageDistribution[] = Array.from({ length: 9 }, (_, i) => ({
      appId: 1,
      language: `lang${i}`,
      reviewCount: 10 - i,
      pctOfTotal: (10 - i) / 55,
    }));
    render(<LanguageDistribution languages={many} />);
    expect(screen.getAllByText("Autres").length).toBeGreaterThan(0);
  });
});
