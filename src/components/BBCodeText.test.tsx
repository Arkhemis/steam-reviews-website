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

  it("renders [hr][/hr] as a separator instead of showing it literally", () => {
    const { container } = render(<BBCodeText text="Avant[hr][/hr]Après" />);

    expect(container.querySelectorAll("hr")).toHaveLength(1);
    expect(container.textContent).toBe("AvantAprès");
  });

  it("keeps rendering the text that follows a [hr]", () => {
    render(<BBCodeText text="[hr][/hr]Connections f." />);
    expect(screen.getByText(/Connections f\./)).toBeInTheDocument();
  });

  it("renders [quote] with its author", () => {
    render(<BBCodeText text="[quote=Gaben]Rien de neuf[/quote]" />);
    expect(screen.getByText("Gaben")).toBeInTheDocument();
    expect(screen.getByText("Rien de neuf")).toBeInTheDocument();
  });

  it("renders [table] rows as a real table", () => {
    render(<BBCodeText text="[table][tr][th]Note[/th][/tr]\n[tr][td]10/10[/td][/tr][/table]" />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Note" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "10/10" })).toBeInTheDocument();
  });

  it("leaves the contents of [noparse] untouched", () => {
    render(<BBCodeText text="[noparse][b]pas gras[/b][/noparse]" />);
    expect(screen.getByText("[b]pas gras[/b]")).toBeInTheDocument();
  });

  it("drops medias it cannot render, contents included", () => {
    const { container } = render(
      <BBCodeText text="Verdict[img]https://example.com/a.png[/img][previewyoutube=abc;full][/previewyoutube]" />,
    );
    expect(container.textContent).toBe("Verdict");
  });

  it("refuses a non-http link and keeps only its label", () => {
    render(<BBCodeText text="[url=javascript:alert(1)]clique ici[/url]" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("clique ici")).toBeInTheDocument();
  });

  it("passes plain text through untouched", () => {
    render(<BBCodeText text="Rien de spécial ici." />);
    expect(screen.getByText("Rien de spécial ici.")).toBeInTheDocument();
  });
});
