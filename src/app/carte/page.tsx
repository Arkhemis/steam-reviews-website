import { geoMercator, geoNaturalEarth1 } from "d3-geo";
import type { Topology } from "topojson-specification";
import { Nav } from "@/components/Nav";
import { getGlobalLanguageDistribution } from "@/lib/data/gameData";
import { fitProjection, topologyToPaths } from "@/lib/geo";
import {
  bucketGlobalLanguages,
  FALLBACK_COLOR,
  getCountryColor,
  getRegionColor,
  LANGUAGE_COLORS,
  LANGUAGE_LABELS,
  type SubregionCountry,
} from "@/lib/map";

import worldTopologyRaw from "world-atlas/countries-110m.json";
import switzerlandTopologyRaw from "@/data/subregions/switzerland.json";
import belgiumTopologyRaw from "@/data/subregions/belgium.json";
import canadaTopologyRaw from "@/data/subregions/canada.json";
import finlandTopologyRaw from "@/data/subregions/finland.json";

// La répartition par langue vient de Postgres et doit être à jour à chaque
// requête ; la DB n'est de toute façon pas joignable au build (image buildée
// hors du réseau docker compose), voir page.tsx.
export const dynamic = "force-dynamic";

const worldTopology = worldTopologyRaw as unknown as Topology;

const WORLD_SIZE: [number, number] = [1000, 480];

const LANGUAGE_LEGEND = [
  { label: "Anglais", color: LANGUAGE_COLORS.english },
  { label: "Chinois simplifié", color: LANGUAGE_COLORS.schinese },
  { label: "Français", color: LANGUAGE_COLORS.french },
  { label: "Allemand", color: LANGUAGE_COLORS.german },
  { label: "Russe", color: LANGUAGE_COLORS.russian },
  { label: "Portugais (Brésil)", color: LANGUAGE_COLORS.brazilian },
  { label: "Non classé", color: FALLBACK_COLOR },
];

type InsetConfig = {
  key: SubregionCountry;
  flag: string;
  title: string;
  topology: Topology;
  objectKey: string;
  size: [number, number];
  legend: { label: string; color: string }[];
};

const INSETS: InsetConfig[] = [
  {
    key: "switzerland",
    flag: "🇨🇭",
    title: "Suisse",
    topology: switzerlandTopologyRaw as unknown as Topology,
    objectKey: "che",
    size: [220, 140],
    legend: [
      { label: "Romandie — Français", color: LANGUAGE_COLORS.french },
      { label: "Deutschschweiz — Deutsch", color: LANGUAGE_COLORS.german },
      { label: "Ticino — Italiano", color: LANGUAGE_COLORS.italian },
    ],
  },
  {
    key: "belgium",
    flag: "🇧🇪",
    title: "Belgique",
    topology: belgiumTopologyRaw as unknown as Topology,
    objectKey: "bel",
    size: [220, 140],
    legend: [
      { label: "Wallonie & Bruxelles — Français", color: LANGUAGE_COLORS.french },
      { label: "Flandre — Nederlands", color: LANGUAGE_COLORS.dutch },
    ],
  },
  {
    key: "canada",
    flag: "🇨🇦",
    title: "Canada",
    topology: canadaTopologyRaw as unknown as Topology,
    objectKey: "can",
    size: [220, 140],
    legend: [
      { label: "Québec — Français", color: LANGUAGE_COLORS.french },
      { label: "Reste du Canada — English", color: LANGUAGE_COLORS.english },
    ],
  },
  {
    key: "finland",
    flag: "🇫🇮",
    title: "Finlande",
    topology: finlandTopologyRaw as unknown as Topology,
    objectKey: "fin",
    size: [220, 140],
    legend: [
      { label: "Ostrobothnia — Svenska", color: LANGUAGE_COLORS.swedish },
      { label: "Reste de la Finlande — Suomi", color: LANGUAGE_COLORS.finnish },
    ],
  },
];

function WorldMap() {
  const projection = fitProjection(geoNaturalEarth1, WORLD_SIZE, worldTopology, "countries");
  const paths = topologyToPaths(worldTopology, "countries", projection);

  return (
    <svg viewBox={`0 0 ${WORLD_SIZE[0]} ${WORLD_SIZE[1]}`} className="w-full">
      {paths.map((p) => (
        <path
          key={p.id ?? p.name}
          d={p.d}
          fill={getCountryColor(p.id ?? "")}
          stroke="var(--ink-muted)"
          strokeWidth={0.3}
          opacity={0.85}
        >
          <title>{p.name}</title>
        </path>
      ))}
    </svg>
  );
}

function RegionInset({ config }: { config: InsetConfig }) {
  const projection = fitProjection(geoMercator, config.size, config.topology, config.objectKey);
  const paths = topologyToPaths(config.topology, config.objectKey, projection);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <h3 className="mb-2 text-sm font-semibold text-white">
        {config.flag} {config.title}
      </h3>
      <svg viewBox={`0 0 ${config.size[0]} ${config.size[1]}`} className="w-full">
        {paths.map((p) => (
          <path
            key={p.name}
            d={p.d}
            fill={getRegionColor(config.key, p.name)}
            stroke="var(--ink-muted)"
            strokeWidth={0.5}
          >
            <title>{p.name}</title>
          </path>
        ))}
      </svg>
      <div className="mt-2 space-y-1 text-xs text-neutral-300">
        {config.legend.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: item.color }} />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function CartePage() {
  const languageRanking = bucketGlobalLanguages(await getGlobalLanguageDistribution());

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Nav />

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">
          🌍 Empreinte linguistique <span className="text-neutral-400">des reviews</span>
        </h1>
        <div className="flex gap-2">
          <span className="rounded-full bg-gradient-to-r from-brand-blue to-brand-red px-3 py-1 text-xs font-bold text-black">
            Global
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300">Par jeu</span>
        </div>
      </div>

      <p className="mt-4 max-w-2xl rounded-r-md border-l-2 border-brand-red bg-white/5 px-3 py-2 text-xs text-neutral-400">
        ⚠️ Basé sur la langue déclarée de chaque review (champ Steam), pas sur une géolocalisation réelle — un pays
        n&apos;a qu&apos;une langue dominante illustrative. Les frontières (monde et régions ci-dessous) sont réelles,
        mais l&apos;association langue↔pays/région reste manuelle. La répartition détaillée ci-dessous, elle, vient
        du mart dbt <code>language_distribution</code>.
      </p>

      <div className="mt-6 rounded-xl bg-gradient-to-b from-white/5 to-transparent p-4">
        <WorldMap />
      </div>

      <div className="mt-5 flex flex-wrap gap-4 text-xs text-neutral-300">
        {LANGUAGE_LEGEND.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>

      <h2 className="mt-8 mb-3 text-xs uppercase tracking-wide text-neutral-400">
        Répartition détaillée (top langues, global)
      </h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {languageRanking.map((row) => {
          const label = row.key === "other" ? "Autres" : LANGUAGE_LABELS[row.key];
          const color = row.key === "other" ? FALLBACK_COLOR : LANGUAGE_COLORS[row.key];
          return (
            <div key={row.key} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
              <span className="flex-1 text-neutral-300">{label}</span>
              <span className="font-bold" style={{ color }}>
                {Math.round(row.pctOfTotal * 100)}%
              </span>
            </div>
          );
        })}
      </div>

      <h2 className="mt-8 mb-3 text-xs uppercase tracking-wide text-neutral-400">
        Zoom : pays bilingues et trilingues (frontières réelles, découpage linguistique illustratif)
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {INSETS.map((config) => (
          <RegionInset key={config.key} config={config} />
        ))}
      </div>
    </main>
  );
}
