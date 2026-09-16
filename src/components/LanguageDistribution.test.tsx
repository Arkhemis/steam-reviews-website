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
  it("names each language in English and gives it its share", () => {
    render(<LanguageDistribution languages={languages} />);
    expect(screen.getByRole("group", { name: "English: 50%" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "French: 30%" })).toBeInTheDocument();
  });

  it("folds languages beyond the top 6 into an Other bucket", () => {
    const many: GameLanguageDistribution[] = Array.from({ length: 9 }, (_, i) => ({
      appId: 1,
      language: `lang${i}`,
      reviewCount: 10 - i,
      pctOfTotal: (10 - i) / 55,
    }));
    render(<LanguageDistribution languages={many} />);
    expect(screen.getByRole("group", { name: /^Other:/ })).toBeInTheDocument();
  });

  it("dit combien d'avis se cachent derrière une part", () => {
    render(<LanguageDistribution languages={languages} />);
    expect(screen.getByRole("group", { name: "English: 50%" })).toHaveAttribute("title", "500 reviews");
  });
});
