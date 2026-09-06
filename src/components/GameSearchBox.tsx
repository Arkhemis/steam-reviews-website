"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { GameSearchCombobox } from "@/components/GameSearchCombobox";

type GameSearchBoxProps = {
  placeholder: string;
  defaultValue?: string;
  className?: string;
};

/**
 * Recherche du catalogue : les suggestions mènent droit à la fiche du jeu, et
 * une validation sans suggestion retombe sur la liste filtrée de `/games`.
 */
export function GameSearchBox({ placeholder, defaultValue, className }: GameSearchBoxProps) {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();

  return (
    <GameSearchCombobox
      placeholder={placeholder}
      ariaLabel="Chercher un jeu"
      defaultValue={defaultValue}
      busy={isNavigating}
      onSelect={(hit) => startNavigation(() => router.push(`/games/${hit.appId}`))}
      onSubmitTerm={(term) => startNavigation(() => router.push(`/games?q=${encodeURIComponent(term)}`))}
      containerClassName={className ?? "max-w-[420px]"}
      inputClassName="w-full rounded-full border border-[#24333f] bg-[#111a21] px-4 py-3 pl-10 text-sm text-[#eef2f4] placeholder:text-[#7d919c] focus:border-white/25 focus:outline-none"
      adornment={
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#7d919c"
          strokeWidth={1.8}
          className="pointer-events-none absolute top-3.5 left-4 h-4 w-4"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m16.5 16.5 4 4" />
        </svg>
      }
    />
  );
}
