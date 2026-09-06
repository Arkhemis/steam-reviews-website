"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { GameSearchCombobox } from "@/components/GameSearchCombobox";

type GameSearchBoxProps = {
  placeholder: string;
  defaultValue?: string;
  className?: string;
  /** `lg` : champ héros de la home. `sm` : version compacte de la barre de nav. */
  size?: "lg" | "sm";
};

// Le champ et la loupe partagent la même hauteur : les deux jeux de classes se
// choisissent ensemble, jamais séparément.
const SIZES = {
  lg: {
    input: "px-4 py-3 pl-10 text-sm",
    icon: "top-3.5 left-4 h-4 w-4",
  },
  sm: {
    input: "px-3.5 py-1.5 pl-8.5 text-xs",
    icon: "top-2 left-3 h-3.5 w-3.5",
  },
} as const;

/**
 * Recherche du catalogue : les suggestions mènent droit à la fiche du jeu, et
 * une validation sans suggestion retombe sur la liste filtrée de `/games`.
 */
export function GameSearchBox({ placeholder, defaultValue, className, size = "lg" }: GameSearchBoxProps) {
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
      inputClassName={`w-full rounded-full border border-[#24333f] bg-[#111a21] text-[#eef2f4] placeholder:text-[#7d919c] focus:border-white/25 focus:outline-none ${SIZES[size].input}`}
      adornment={
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#7d919c"
          strokeWidth={1.8}
          className={`pointer-events-none absolute ${SIZES[size].icon}`}
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m16.5 16.5 4 4" />
        </svg>
      }
    />
  );
}
