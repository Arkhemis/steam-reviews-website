import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BattleLoading from "@/app/battle/loading";
import CarteLoading from "@/app/carte/loading";
import ClassementsLoading from "@/app/classements/loading";
import GameLoading from "@/app/games/[appId]/loading";
import GamesLoading from "@/app/games/loading";
import RootLoading from "@/app/loading";

// `layout.tsx` rend `<body className="min-h-full flex flex-col">`. Un enfant
// direct du body avec `margin-inline: auto` perd `align-self: stretch` (flexbox
// §9.4 : stretch ne s'applique pas si une marge de l'axe transversal vaut
// `auto`), donc il se dimensionne en `fit-content` au lieu de la largeur du
// viewport : la nav s'effondre et le squelette se ratatine au centre. Les pages
// réelles s'en sortent parce qu'elles wrappent leur `mx-auto` dans un
// `<div className="min-h-screen bg-…">` ; les loading states doivent faire pareil.
const LOADINGS = [
  ["/", RootLoading],
  ["/battle", BattleLoading],
  ["/carte", CarteLoading],
  ["/classements", ClassementsLoading],
  ["/games", GamesLoading],
  ["/games/[appId]", GameLoading],
] as const;

describe.each(LOADINGS)("loading state de %s", (_route, Loading) => {
  function root() {
    const { container } = render(<Loading />);
    const element = container.firstElementChild;
    if (!element) throw new Error("le loading state ne rend rien");
    return element;
  }

  it("n'applique pas de marge auto sur son élément racine", () => {
    expect(root().className).not.toMatch(/\bm[xl]?-auto\b/);
  });

  it("porte le fond du site, sinon le dégradé du body transparaît", () => {
    expect(root().className).toContain("min-h-screen");
    expect(root().className).toContain("bg-[#0c1116]");
  });

  it("centre son contenu à la même largeur que la page qu'il remplace", () => {
    const container = root().firstElementChild;
    expect(container?.className).toContain("mx-auto");
    expect(container?.className).toContain("max-w-[1320px]");
  });
});
