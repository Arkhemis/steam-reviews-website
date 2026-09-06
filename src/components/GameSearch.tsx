"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { GameSearchCombobox } from "@/components/GameSearchCombobox";
import type { GameSearchHit } from "@/lib/gameSearch";

type GameSearchProps = {
  /** Jeu actuellement appliqué à la carte, `null` en mode global. */
  selected: GameSearchHit | null;
};

function coverStyle(coverUrl: string | null) {
  return coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined;
}

export function GameSearch({ selected }: GameSearchProps) {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();

  function applyGame(appId: number | null) {
    startNavigation(() => router.push(appId === null ? "/carte" : `/carte?app=${appId}`));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => applyGame(null)}
        disabled={selected === null}
        className={
          selected === null
            ? "rounded-full bg-gradient-to-r from-brand-blue to-brand-red px-3 py-1.5 text-xs font-bold text-black"
            : "rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-300 hover:border-white/25 hover:text-white"
        }
      >
        Global
      </button>

      {selected && (
        <span className="flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-blue to-brand-red py-1 pr-1 pl-1.5 text-xs font-bold text-black">
          <span
            className="h-5 w-5 rounded-full bg-black/30 bg-cover bg-center"
            style={coverStyle(selected.coverUrl)}
            aria-hidden
          />
          {selected.name}
          <button
            type="button"
            onClick={() => applyGame(null)}
            aria-label={`Retirer le filtre ${selected.name}`}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-black/25 leading-none hover:bg-black/45"
          >
            ✕
          </button>
        </span>
      )}

      <GameSearchCombobox
        ariaLabel="Filtrer la carte par jeu"
        placeholder={selected ? "🔍 Filtrer par un autre jeu…" : "🔍 Filtrer la carte par jeu, ex. Baldur's Gate 3…"}
        busy={isNavigating}
        onSelect={(hit) => applyGame(hit.appId)}
        containerClassName="min-w-[15rem] flex-1"
        inputClassName="w-full rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-500 focus:border-white/25 focus:outline-none"
      />
    </div>
  );
}
