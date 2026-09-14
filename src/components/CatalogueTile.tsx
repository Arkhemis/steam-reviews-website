import Image from "next/image";
import Link from "next/link";
import { verdictColor } from "@/components/GameCoverTile";
import type { CatalogueGame } from "@/lib/data/types";

// Les deux vignettes de `/charts`. Même jaquette, même liseré de verdict — le
// seul endroit où le score apparaît sur une image seule — mais pas la même
// densité : les rubriques du haut de page présentent huit jeux et se lisent en
// diagonale, la grille en présente vingt-quatre et doit porter la variation.

const enCompact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function Cover({ game, sizes, children }: { game: CatalogueGame; sizes: string; children?: React.ReactNode }) {
  return (
    <span className="relative block aspect-[2/3] overflow-hidden rounded-[3px] bg-white/5">
      {game.coverUrl && <Image src={game.coverUrl} alt="" fill sizes={sizes} className="object-cover" />}
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: verdictColor(game.pctPositive * 100) }} />
      {children}
    </span>
  );
}

function formatDelta(deltaPct: number): string {
  return `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}`;
}

/** La vignette des rubriques : jaquette, titre, score et volume sur une ligne. */
export function ShelfTile({ game, sizes }: { game: CatalogueGame; sizes: string }) {
  const color = verdictColor(game.pctPositive * 100);

  return (
    <Link href={`/games/${game.appId}`} className="group block text-[#eef2f4]">
      <Cover game={game} sizes={sizes} />
      <span className="mt-[7px] block truncate text-xs font-bold group-hover:text-brand-blue">{game.name}</span>
      <span className="mt-0.5 flex items-baseline gap-[7px] font-mono text-[11px]">
        <span style={{ color }}>{Math.round(game.pctPositive * 100)}%</span>
        <span className="text-[#7d919c]">{enCompact.format(game.totalReviews)}</span>
      </span>
    </Link>
  );
}

/**
 * La vignette de la grille. Le bandeau du bas porte la variation sur trente
 * jours à gauche et le volume à droite ; un jeu trop peu commenté pour qu'une
 * variation veuille dire quelque chose n'affiche que le volume.
 */
export function CatalogueTile({ game, sizes }: { game: CatalogueGame; sizes: string }) {
  const color = verdictColor(game.pctPositive * 100);

  return (
    <Link href={`/games/${game.appId}`} className="group block text-[#eef2f4]">
      <Cover game={game} sizes={sizes}>
        <span className="absolute inset-x-0 bottom-0 flex justify-between gap-1.5 bg-[linear-gradient(180deg,rgba(12,17,22,0)_0%,rgba(12,17,22,0.92)_62%)] px-1.5 py-[5px] font-mono text-[10px]">
          <span style={{ color: (game.deltaPct ?? 0) >= 0 ? "var(--status-good)" : "var(--status-critical)" }}>
            {game.deltaPct === undefined ? "" : formatDelta(game.deltaPct)}
          </span>
          <span className="text-[#9fb2bd]">{enCompact.format(game.totalReviews)}</span>
        </span>
      </Cover>
      <span className="mt-[7px] block truncate text-xs font-bold group-hover:text-brand-blue">{game.name}</span>
      <span className="mt-0.5 block font-mono text-xs" style={{ color }}>
        {Math.round(game.pctPositive * 100)}%
      </span>
    </Link>
  );
}
