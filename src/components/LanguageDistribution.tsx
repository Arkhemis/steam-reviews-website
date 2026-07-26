"use client";

import { useState } from "react";
import type { GameLanguageDistribution } from "@/lib/data/types";

// Fixed language -> categorical slot mapping. Order never changes: it's the
// CVD-safety mechanism from the dataviz skill's validated palette. A language
// not in this list, or any language past the top 6 by share, folds into the
// muted "Autres" bucket rather than generating a new hue.
const LANGUAGE_SLOT_ORDER = ["english", "schinese", "french", "german", "russian", "brazilian"] as const;

const CATEGORICAL_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300"];

function colorForLanguage(language: string): string {
  const index = LANGUAGE_SLOT_ORDER.indexOf(language as (typeof LANGUAGE_SLOT_ORDER)[number]);
  return index === -1 ? "var(--series-fallback)" : CATEGORICAL_DARK[index];
}

type LanguageDistributionProps = {
  languages: GameLanguageDistribution[];
};

export function LanguageDistribution({ languages }: LanguageDistributionProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const sorted = [...languages].sort((a, b) => b.pctOfTotal - a.pctOfTotal);
  const top = sorted.slice(0, 6);
  const rest = sorted.slice(6);

  const rows =
    rest.length > 0
      ? [
          ...top,
          {
            appId: top[0]?.appId ?? 0,
            language: "Autres",
            reviewCount: rest.reduce((sum, l) => sum + l.reviewCount, 0),
            pctOfTotal: rest.reduce((sum, l) => sum + l.pctOfTotal, 0),
          },
        ]
      : top;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-neutral-300">
        {rows.map((row) => (
          <span key={row.language} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: colorForLanguage(row.language) }}
            />
            {row.language}
          </span>
        ))}
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.language}
            className="flex items-center gap-3 text-xs"
            onPointerEnter={() => setHovered(row.language)}
            onPointerLeave={() => setHovered(null)}
            role="group"
            aria-label={`${row.language}: ${Math.round(row.pctOfTotal * 100)}%`}
          >
            <span className="w-24 truncate text-neutral-300">{row.language}</span>
            <div className="h-[10px] flex-1 overflow-hidden rounded-[4px] bg-white/5">
              <div
                className="h-full rounded-r-[4px]"
                style={{
                  width: `${row.pctOfTotal * 100}%`,
                  backgroundColor: colorForLanguage(row.language),
                }}
              />
            </div>
            <span className="w-10 text-right font-semibold text-white">{Math.round(row.pctOfTotal * 100)}%</span>
            {hovered === row.language && (
              <span className="text-neutral-400">{row.reviewCount.toLocaleString("fr-FR")} reviews</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
