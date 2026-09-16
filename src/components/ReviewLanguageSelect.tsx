"use client";

import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";
import type { GameReviewLanguage } from "@/lib/data/types";
import { LANGUAGE_LABELS, type LanguageKey } from "@/lib/map";
import { ALL_LANGUAGES } from "@/lib/reviewLanguage";

type ReviewLanguageSelectProps = {
  /** Langues présentes dans `review_highlight` pour ce jeu, les plus fournies d'abord. */
  languages: GameReviewLanguage[];
  /** Langue appliquée, `null` quand le filtre est sur « toutes les langues ». */
  selected: string | null;
};

function labelFor(language: string): string {
  return LANGUAGE_LABELS[language as LanguageKey] ?? language;
}

// Un `<select>` plutôt que des puces : Steam expose une trentaine de langues et
// une ligne de puces déborderait la barre de boutons.
export function ReviewLanguageSelect({ languages, selected }: ReviewLanguageSelectProps) {
  const router = useRouter();
  const labelId = useId();
  const [isNavigating, startNavigation] = useTransition();

  // Une seule langue : le choix est vide de sens, on n'encombre pas la barre.
  if (languages.length <= 1) return null;

  return (
    <span className="flex items-center gap-2">
      <label id={labelId} htmlFor={`${labelId}-select`} className="sr-only">
        Review language
      </label>
      <select
        id={`${labelId}-select`}
        value={selected ?? ALL_LANGUAGES}
        disabled={isNavigating}
        onChange={(event) => {
          const next = event.target.value;
          startNavigation(() => router.push(`?lang=${next}`, { scroll: false }));
        }}
        className="rounded-full border border-[#24333f] px-3 py-1.5 font-mono text-[10px] tracking-[0.1em] text-[#9fb2bd] uppercase disabled:opacity-40"
      >
        <option value={ALL_LANGUAGES}>🌐 All languages</option>
        {languages.map((entry) => (
          <option key={entry.language} value={entry.language}>
            {labelFor(entry.language)} ({entry.reviewCount})
          </option>
        ))}
      </select>
    </span>
  );
}
