import { geoNaturalEarth1 } from "d3-geo";
import type { Topology } from "topojson-specification";
import { Nav } from "@/components/Nav";
import { getLanguageReviewScores } from "@/lib/data/gameData";
import { fitProjection, topologyToPaths } from "@/lib/geo";
import { COUNTRY_LANGUAGE, FALLBACK_COLOR, getCountryScoreColor, LANGUAGE_LABELS, scoreToColor, type LanguageKey } from "@/lib/map";

import worldTopologyRaw from "world-atlas/countries-110m.json";

// La répartition/note par langue vient de Postgres et doit être à jour à
// chaque requête ; la DB n'est de toute façon pas joignable au build (image
// buildée hors du réseau docker compose), voir page.tsx (home).
export const dynamic = "force-dynamic";

const worldTopology = worldTopologyRaw as unknown as Topology;

const WORLD_SIZE: [number, number] = [1000, 480];

function WorldMap({ scores }: { scores: Record<string, number> }) {
  const projection = fitProjection(geoNaturalEarth1, WORLD_SIZE, worldTopology, "countries");
  const paths = topologyToPaths(worldTopology, "countries", projection);

  return (
    <svg viewBox={`0 0 ${WORLD_SIZE[0]} ${WORLD_SIZE[1]}`} className="w-full">
      {paths.map((p) => {
        const lang = COUNTRY_LANGUAGE[p.id ?? ""];
        const score = lang ? scores[lang] : undefined;
        const color = getCountryScoreColor(p.id ?? "", scores);
        const title =
          lang && score !== undefined
            ? `${p.name} — ${LANGUAGE_LABELS[lang]} — ${Math.round(score * 100)}% positif`
            : `${p.name} — non classé`;
        return (
          <path
            key={p.id ?? p.name}
            d={p.d}
            fill={color}
            stroke="var(--background)"
            strokeWidth={0.4}
            opacity={color === FALLBACK_COLOR ? 0.55 : 0.92}
          >
            <title>{title}</title>
          </path>
        );
      })}
    </svg>
  );
}

export default async function CartePage() {
  const scoreRows = await getLanguageReviewScores();
  const scores = Object.fromEntries(scoreRows.map((row) => [row.language, row.pctPositive]));

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Nav />

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">
          🌍 Score des reviews <span className="text-neutral-400">par langue</span>
        </h1>
        <div className="flex gap-2">
          <span className="rounded-full bg-gradient-to-r from-brand-blue to-brand-red px-3 py-1 text-xs font-bold text-black">
            Global
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300">Par jeu</span>
        </div>
      </div>

      <p className="mt-4 max-w-2xl rounded-r-md border-l-2 border-brand-red bg-white/5 px-3 py-2 text-xs text-neutral-400">
        ⚠️ Chaque pays est coloré selon la note moyenne (% d&apos;avis positifs) de sa langue dominante déclarée
        (champ Steam), pas selon une géolocalisation réelle des joueurs. L&apos;association pays↔langue reste
        manuelle.
      </p>

      <div className="mt-6 rounded-xl bg-gradient-to-b from-white/5 to-transparent p-4">
        <WorldMap scores={scores} />
      </div>

      <div className="mt-5 flex items-center gap-3">
        <span className="text-xs font-semibold" style={{ color: "var(--status-critical)" }}>
          Mal noté
        </span>
        <div className="flex-1">
          <div
            className="h-2.5 rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)]"
            style={{
              background: "linear-gradient(90deg, var(--status-critical), var(--status-warning), var(--status-good))",
            }}
          />
          <div className="mt-1 flex justify-between text-[0.65rem] text-neutral-500">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
        <span className="text-xs font-semibold" style={{ color: "var(--status-good)" }}>
          Bien noté
        </span>
      </div>
      <p className="mt-2 text-[0.65rem] text-neutral-500">
        <span className="mr-1.5 inline-block h-2 w-2 rounded-sm align-middle" style={{ backgroundColor: FALLBACK_COLOR }} />
        Non classé — langue dominante non trackée ou trop incertaine pour être assignée
      </p>

      <h2 className="mt-8 mb-3 text-xs uppercase tracking-wide text-neutral-400">
        Répartition &amp; note, toutes les langues Steam
      </h2>
      <div className="flex flex-col gap-2">
        {scoreRows.map((row) => {
          const label = LANGUAGE_LABELS[row.language as LanguageKey] ?? row.language;
          const color = scoreToColor(row.pctPositive);
          return (
            <div
              key={row.language}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-xs sm:grid-cols-[140px_100px_1fr_auto]"
            >
              <span className="font-semibold text-white">{label}</span>
              <span className="font-mono text-[0.7rem] text-neutral-500 tabular-nums">
                {row.totalReviews.toLocaleString("fr-FR")} reviews
              </span>
              <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-white/5 sm:col-span-1">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-blue to-brand-red"
                  style={{ width: `${(row.pctOfTotal * 100).toFixed(1)}%` }}
                />
              </div>
              <span
                className="justify-self-end rounded-full border px-2.5 py-1 font-mono text-[0.68rem] font-semibold whitespace-nowrap"
                style={{ backgroundColor: `${color}22`, color, borderColor: `${color}55` }}
              >
                {Math.round(row.pctPositive * 100)}% positif
              </span>
            </div>
          );
        })}
      </div>
    </main>
  );
}
