import Image from "next/image";
import Link from "next/link";
import { geoNaturalEarth1 } from "d3-geo";
import type { Topology } from "topojson-specification";
import { GameSearch } from "@/components/GameSearch";
import { Nav } from "@/components/Nav";
import { getGameLanguageReviewScores, getGameStats, getLanguageReviewScores } from "@/lib/data/gameData";
import type { GameStats, LanguageReviewScore } from "@/lib/data/types";
import { fitProjection, topologyToPaths } from "@/lib/geo";
import {
  buildScoreMap,
  COUNTRY_LANGUAGE,
  FALLBACK_COLOR,
  getCountryScoreColor,
  LANGUAGE_LABELS,
  MIN_REVIEWS_FOR_GAME_COLOR,
  scoreToColor,
  type LanguageKey,
} from "@/lib/map";

import worldTopologyRaw from "world-atlas/countries-110m.json";

// La répartition/note par langue vient de Postgres et doit être à jour à
// chaque requête ; la DB n'est de toute façon pas joignable au build (image
// buildée hors du réseau docker compose), voir page.tsx (home).
export const dynamic = "force-dynamic";

const worldTopology = worldTopologyRaw as unknown as Topology;

const WORLD_SIZE: [number, number] = [1000, 480];

// La géométrie ne dépend pas des scores : projetée une fois au chargement du
// module plutôt qu'à chaque requête.
const WORLD_PATHS = topologyToPaths(
  worldTopology,
  "countries",
  fitProjection(geoNaturalEarth1, WORLD_SIZE, worldTopology, "countries"),
);

function WorldMap({ scores }: { scores: Record<string, number> }) {
  return (
    <svg viewBox={`0 0 ${WORLD_SIZE[0]} ${WORLD_SIZE[1]}`} className="w-full">
      {WORLD_PATHS.map((p) => {
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

function SelectedGameHeader({ game, scoreRows }: { game: GameStats; scoreRows: LanguageReviewScore[] }) {
  const coloredLanguages = scoreRows.filter((row) => row.totalReviews >= MIN_REVIEWS_FOR_GAME_COLOR).length;

  return (
    <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#1a2530] bg-white/5 p-3">
      <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-white/10">
        {game.coverUrl && <Image src={game.coverUrl} alt="" fill sizes="56px" className="object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-white">{game.name}</div>
        <div className="text-xs text-[#9fb2bd]">
          {game.totalReviews.toLocaleString("fr-FR")} reviews ·{" "}
          <span style={{ color: scoreToColor(game.pctPositive) }}>{Math.round(game.pctPositive * 100)}% positif</span>{" "}
          au global · {coloredLanguages} langue{coloredLanguages > 1 ? "s" : ""} assez commentée
          {coloredLanguages > 1 ? "s" : ""} pour colorer la carte
        </div>
      </div>
      <Link href={`/games/${game.appId}`} className="text-xs whitespace-nowrap text-brand-blue underline">
        Fiche du jeu ↗
      </Link>
    </div>
  );
}

type CartePageProps = {
  searchParams: Promise<{ app?: string }>;
};

export default async function CartePage({ searchParams }: CartePageProps) {
  const { app } = await searchParams;
  const requestedAppId = app && /^\d+$/.test(app) ? Number(app) : null;

  // Un app_id inconnu (URL bidouillée, jeu retiré du catalogue) retombe sur la
  // carte globale plutôt que sur une carte entièrement grise.
  const game = requestedAppId === null ? null : await getGameStats(requestedAppId);
  const scoreRows = game ? await getGameLanguageReviewScores(game.appId) : await getLanguageReviewScores();

  const scores = buildScoreMap(scoreRows, game ? MIN_REVIEWS_FOR_GAME_COLOR : 0);

  return (
    <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-7">
        <Nav />

        <h1 className="mt-6 text-2xl font-extrabold tracking-tight">
          🌍 Score des reviews <span className="text-[#9fb2bd]">par langue</span>
        </h1>

        <div className="mt-3">
          <GameSearch
            selected={
              game && {
                appId: game.appId,
                name: game.name,
                coverUrl: game.coverUrl,
                totalReviews: game.totalReviews,
                pctPositive: game.pctPositive,
              }
            }
          />
        </div>

        {requestedAppId !== null && !game && (
          <p className="mt-4 rounded-r-md border-l-2 border-brand-red bg-white/5 px-3 py-2 text-xs text-[#9fb2bd]">
            Jeu introuvable (app id {requestedAppId}) — affichage de la carte globale.
          </p>
        )}

        {game && <SelectedGameHeader game={game} scoreRows={scoreRows} />}

        <p className="mt-4 max-w-2xl rounded-r-md border-l-2 border-brand-red bg-white/5 px-3 py-2 text-xs text-[#9fb2bd]">
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
            <div className="mt-1 flex justify-between text-[0.65rem] text-[#5f7481]">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
          <span className="text-xs font-semibold" style={{ color: "var(--status-good)" }}>
            Bien noté
          </span>
        </div>
        <p className="mt-2 text-[0.65rem] text-[#5f7481]">
          <span className="mr-1.5 inline-block h-2 w-2 rounded-sm align-middle" style={{ backgroundColor: FALLBACK_COLOR }} />
          Non classé — langue dominante non trackée ou trop incertaine pour être assignée
          {game ? `, ou moins de ${MIN_REVIEWS_FOR_GAME_COLOR} avis dans cette langue pour ce jeu` : ""}
        </p>

        <h2 className="mt-8 mb-3 text-xs uppercase tracking-wide text-[#9fb2bd]">
          {game ? `Répartition & note par langue — ${game.name}` : "Répartition & note, toutes les langues Steam"}
        </h2>
        {scoreRows.length === 0 ? (
          <p className="text-sm text-[#9fb2bd]">Aucune review par langue pour ce jeu.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {scoreRows.map((row) => {
              const label = LANGUAGE_LABELS[row.language as LanguageKey] ?? row.language;
              const tooThin = Boolean(game) && row.totalReviews < MIN_REVIEWS_FOR_GAME_COLOR;
              const color = scoreToColor(row.pctPositive);
              // Le badge d'une langue trop peu commentée est neutralisé, comme
              // le pays correspondant sur la carte.
              const badgeStyle = tooThin
                ? { backgroundColor: "rgba(255,255,255,.04)", color: "var(--ink-muted)", borderColor: "rgba(255,255,255,.1)" }
                : { backgroundColor: `${color}22`, color, borderColor: `${color}55` };
              return (
                <div
                  key={row.language}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-lg border border-[#1a2530] bg-white/5 px-3 py-2.5 text-xs sm:grid-cols-[140px_100px_1fr_auto]"
                >
                  <span className="font-semibold text-white">{label}</span>
                  <span className="font-mono text-[0.7rem] text-[#5f7481] tabular-nums">
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
                    style={badgeStyle}
                    title={tooThin ? `Moins de ${MIN_REVIEWS_FOR_GAME_COLOR} avis : non coloré sur la carte` : undefined}
                  >
                    {Math.round(row.pctPositive * 100)}% positif
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
