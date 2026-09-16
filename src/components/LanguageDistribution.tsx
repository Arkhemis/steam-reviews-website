import { LANGUAGE_LABELS, type LanguageKey } from "@/lib/map";
import type { GameLanguageDistribution } from "@/lib/data/types";

// Fixed language -> categorical slot mapping. Order never changes: it's the
// CVD-safety mechanism from the dataviz skill's validated palette. A language
// not in this list, or any language past the top 6 by share, folds into the
// muted "Other" bucket rather than generating a new hue.
const LANGUAGE_SLOT_ORDER = ["english", "schinese", "french", "german", "russian", "brazilian"] as const;

const CATEGORICAL_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300"];

const OTHER = "Other";

function colorForLanguage(language: string): string {
  const index = LANGUAGE_SLOT_ORDER.indexOf(language as (typeof LANGUAGE_SLOT_ORDER)[number]);
  return index === -1 ? "var(--series-fallback)" : CATEGORICAL_DARK[index];
}

function labelFor(language: string): string {
  return language === OTHER ? OTHER : (LANGUAGE_LABELS[language as LanguageKey] ?? language);
}

type LanguageDistributionProps = {
  languages: GameLanguageDistribution[];
};

// Une seule barre empilée plutôt que sept barres alignées : la question que
// pose le bandeau est « qui a écrit ces avis », c'est-à-dire un partage d'un
// même tout — et il tient sur dix pixels de haut, entre le bandeau de KPI et
// la courbe, là où sept lignes auraient repoussé le reste de la page.
export function LanguageDistribution({ languages }: LanguageDistributionProps) {
  const sorted = [...languages].sort((a, b) => b.pctOfTotal - a.pctOfTotal);
  const top = sorted.slice(0, 6);
  const rest = sorted.slice(6);

  const rows =
    rest.length > 0
      ? [
          ...top,
          {
            appId: top[0]?.appId ?? 0,
            language: OTHER,
            reviewCount: rest.reduce((sum, l) => sum + l.reviewCount, 0),
            pctOfTotal: rest.reduce((sum, l) => sum + l.pctOfTotal, 0),
          },
        ]
      : top;

  if (rows.length === 0) {
    return <p className="mt-2.5 text-sm text-[#7d919c]">No review language recorded yet.</p>;
  }

  return (
    <div>
      <div className="mt-2.5 flex h-2.5 overflow-hidden rounded-[2px]">
        {rows.map((row) => (
          <span
            key={row.language}
            className="block"
            style={{ width: `${row.pctOfTotal * 100}%`, backgroundColor: colorForLanguage(row.language) }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {rows.map((row) => (
          <span
            key={row.language}
            role="group"
            aria-label={`${labelFor(row.language)}: ${Math.round(row.pctOfTotal * 100)}%`}
            title={`${row.reviewCount.toLocaleString("en-US")} reviews`}
            className="flex items-center gap-1.5 font-mono text-[10px] text-[#9fb2bd]"
          >
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-[2px]"
              style={{ backgroundColor: colorForLanguage(row.language) }}
            />
            {labelFor(row.language)} {Math.round(row.pctOfTotal * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}
