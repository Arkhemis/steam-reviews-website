import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReviewLanguageSelect } from "@/components/ReviewLanguageSelect";
import type { GameReviewLanguage } from "@/lib/data/types";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const languages: GameReviewLanguage[] = [
  { language: "english", reviewCount: 60 },
  { language: "schinese", reviewCount: 40 },
  { language: "french", reviewCount: 12 },
];

beforeEach(() => {
  push.mockClear();
});

describe("ReviewLanguageSelect", () => {
  it("lists every available language under its French label, plus an all-languages option", () => {
    render(<ReviewLanguageSelect languages={languages} selected="english" />);

    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options[0]).toMatch(/Toutes les langues/);
    expect(options[1]).toMatch(/^Anglais/);
    expect(options[2]).toMatch(/^Chinois simplifié/);
    expect(options[3]).toMatch(/^Français/);
  });

  it("shows how many highlighted reviews each language has", () => {
    render(<ReviewLanguageSelect languages={languages} selected="english" />);

    expect(screen.getByRole("option", { name: /Anglais \(60\)/ })).toBeInTheDocument();
  });

  it("falls back to the raw Steam code for a language it has no label for", () => {
    render(<ReviewLanguageSelect languages={[...languages, { language: "klingon", reviewCount: 1 }]} selected="english" />);

    expect(screen.getByRole("option", { name: /klingon/ })).toBeInTheDocument();
  });

  it("preselects the resolved language", () => {
    render(<ReviewLanguageSelect languages={languages} selected="schinese" />);

    expect(screen.getByRole("combobox")).toHaveValue("schinese");
  });

  it("preselects the all-languages option when no language filter is applied", () => {
    render(<ReviewLanguageSelect languages={languages} selected={null} />);

    expect(screen.getByRole("combobox")).toHaveValue("all");
  });

  it("navigates to the chosen language, keeping the current page position", async () => {
    render(<ReviewLanguageSelect languages={languages} selected="english" />);

    await userEvent.selectOptions(screen.getByRole("combobox"), "french");

    expect(push).toHaveBeenCalledWith("?lang=french", { scroll: false });
  });

  it("renders nothing when the game only has reviews in one language", () => {
    const { container } = render(
      <ReviewLanguageSelect languages={[{ language: "french", reviewCount: 10 }]} selected="french" />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
