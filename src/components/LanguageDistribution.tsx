import { LANGUAGE_LABELS, type LanguageKey } from "@/lib/map";
import type { GameLanguageDistribution } from "@/lib/data/types";

// Une couleur par langue, tirée du drapeau du pays qu'elle évoque d'abord
// (Angleterre rouge, France bleu, Espagne jaune, Italie vert…). Beaucoup de
// drapeaux sont rouges ou bleus : quand deux langues qui cohabitent souvent en
// tête d'un même jeu tomberaient sur la même teinte, l'une prend une variante
// (rouge profond pour l'allemand, blanc de la Pologne, rose sakura pour le
// japonais…) plutôt que la couleur exacte du drapeau. Pas daltonien-safe :
// c'est le prix de couleurs qui se reconnaissent sans légende.
const LANGUAGE_COLORS: Record<LanguageKey, string> = {
  english: "#cf142b", // croix de saint Georges
  schinese: "#f26522", // rouge de Chine, tiré vers l'orange pour quitter l'anglais
  tchinese: "#4a5ec8", // canton bleu de Taïwan
  french: "#2f63d6",
  german: "#9e1b32", // rouge profond, distinct de l'anglais
  spanish: "#f1bf00",
  latam: "#b8860b", // or plus sombre que l'espagnol
  italian: "#009246",
  brazilian: "#6cc24a", // vert clair, distinct de l'italien
  portuguese: "#046a38",
  russian: "#6fa8ff", // bleu clair, distinct du français
  ukrainian: "#ffe14d", // jaune citron, distinct de l'espagnol
  polish: "#e9e4e4", // bande blanche du drapeau
  turkish: "#ff5a5f", // rouge clair, distinct de l'anglais
  japanese: "#f19cbb", // sakura
  koreana: "#1c4fa0",
  dutch: "#ff7f00", // oranje
  swedish: "#006aa7",
  norwegian: "#ba0c2f",
  danish: "#c8102e",
  finnish: "#2a5caa",
  czech: "#11457e",
  hungarian: "#477050",
  romanian: "#fcd116",
  bulgarian: "#00966e",
  greek: "#5a9bd5",
  arabic: "#1f8a5b",
  thai: "#a51931",
  vietnamese: "#da251d",
};

const OTHER = "Other";

function colorForLanguage(language: string): string {
  return LANGUAGE_COLORS[language as LanguageKey] ?? "var(--series-fallback)";
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
