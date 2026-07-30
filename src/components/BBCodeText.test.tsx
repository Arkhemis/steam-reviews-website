import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BBCodeText } from "@/components/BBCodeText";

describe("BBCodeText", () => {
  it("strips [h1] and [b] tags instead of showing them literally", () => {
    const text =
      "[h1]Injouable en l'état.[/h1] Après près de 500 heures de jeu ce dernier est devenu tout simplement infernal " +
      "et désagréable à jouer à cause de [b]l'accumulation de bugs divers[/b] affectant tous les pans du jeu.";
    render(<BBCodeText text={text} />);

    expect(screen.getByText(/Injouable en l'état\./)).toBeInTheDocument();
    expect(screen.getByText(/l'accumulation de bugs divers/)).toBeInTheDocument();
    expect(screen.queryByText(/\[h1\]/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\[b\]/)).not.toBeInTheDocument();
  });

  it("renders bold and header text with emphasis elements", () => {
    render(<BBCodeText text="[b]gras[/b] et [h2]titre[/h2]" />);

    expect(screen.getByText("gras").tagName).toBe("STRONG");
    expect(screen.getByText("titre").tagName).toBe("STRONG");
  });

  it("handles nested tags", () => {
    render(<BBCodeText text="[b][h1]Points positifs :[/h1][/b]" />);
    expect(screen.getByText("Points positifs :")).toBeInTheDocument();
  });

  it("renders bbcode lists as list items", () => {
    render(<BBCodeText text="[list][*]Un[*]Deux[/list]" />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Un")).toBeInTheDocument();
    expect(screen.getByText("Deux")).toBeInTheDocument();
  });

  it("renders [url] as a link", () => {
    render(<BBCodeText text="[url=https://example.com]lien[/url]" />);
    const link = screen.getByRole("link", { name: "lien" });
    expect(link).toHaveAttribute("href", "https://example.com");
  });

  it("passes plain text through untouched", () => {
    render(<BBCodeText text="Rien de spécial ici." />);
    expect(screen.getByText("Rien de spécial ici.")).toBeInTheDocument();
  });
});
