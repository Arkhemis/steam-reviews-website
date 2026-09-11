import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InfoHint } from "@/components/InfoHint";

describe("InfoHint", () => {
  it("names the trigger with the explanation", () => {
    render(<InfoHint text="Share of the reviews written that month." />);
    expect(
      screen.getByRole("button", { name: "Share of the reviews written that month." }),
    ).toBeInTheDocument();
  });

  it("keeps the bubble out of the accessibility tree, the trigger carrying the text", () => {
    render(<InfoHint text="Share of the reviews written that month." />);
    expect(screen.getByTestId("info-hint-bubble")).toHaveAttribute("aria-hidden", "true");
  });
});
