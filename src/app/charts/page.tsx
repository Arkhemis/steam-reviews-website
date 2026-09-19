import Image from "next/image";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { CatalogueTile, ShelfTile } from "@/components/CatalogueTile";
import { ChartsFilterForm } from "@/components/ChartsFilterForm";
import { ScaleBand, SectionHead } from "@/components/HomeEditorial";
import { InfoHint } from "@/components/InfoHint";
import { Nav } from "@/components/Nav";
import {
  CHART_FILTERS,
  DEFAULT_CHART_FILTER,
  type ChartFilterKey,
  chartFilter,
  chartsHref,
  isChartFilterKey,
} from "@/lib/charts";
import { resolveSteamHeroArt } from "@/lib/steamArtwork";
import {
  getCataloguePage,
  getLanguageReviewScores,
  getRecentDeltas,
  getSiteStats,
  getTrendingGames,
} from "@/lib/data/gameData";
import type { CatalogueGame } from "@/lib/data/types";

// Comme la home, la page lit Postgres à chaud (la base n'est pas joignable au
// build) mais chaque agrégat est caché à part : le héros et les rubriques ne
// bougent qu'au rythme du pipeline, seule la grille dépend vraiment de la
// query string.
export const dynamic = "force-dynamic";

const REVALIDATE_SECONDS = 900;

const PAGE_SIZE = 24;
const SHELF_SIZE = 8;

// « Hidden gems » : adoré, mais peu commenté. Le plancher de volume écarte le
// jeu à douze avis qui affiche 100 % par accident ; le plafond écarte les
// mastodontes, qui n'ont rien de caché ; le plancher de score fait que la
// rubrique montre moins de huit jeux plutôt que d'y glisser un jeu médiocre
// sous un titre qui promet le contraire.
const GEM_MIN_REVIEWS = 500;
const GEM_MAX_REVIEWS = 200_000;
const GEM_MIN_PCT = 95;

const enFull = new Intl.NumberFormat("en-US");

function cached<T>(key: string, read: () => Promise<T>) {
  return unstable_cache(read, [key], { revalidate: REVALIDATE_SECONDS });
}

const siteStats = cached("charts-site-stats", getSiteStats);
const languageScores = cached("charts-language-scores", getLanguageReviewScores);
const topMover = cached("charts-top-mover", () => getTrendingGames(1));

const shelves = cached(`charts-shelves-${GEM_MIN_REVIEWS}-${GEM_MAX_REVIEWS}-${GEM_MIN_PCT}`, async () => {
  const [gems, fresh, split] = await Promise.all([
    getCataloguePage({
      sort: "best-rated",
      limit: SHELF_SIZE,
      minReviews: GEM_MIN_REVIEWS,
      maxReviews: GEM_MAX_REVIEWS,
      minPct: GEM_MIN_PCT,
    }),
    getCataloguePage({ sort: "recent", limit: SHELF_SIZE, minReviews: chartFilter("recent").minReviews }),
    getCataloguePage({ sort: "polarised", limit: SHELF_SIZE, minReviews: chartFilter("polarised").minReviews }),
  ]);

  return [
    { title: "Hidden gems", note: "adored, barely reviewed", filter: "best-rated" as const, games: gems.games },
    { title: "Freshly released", note: "newest games in the catalogue", filter: "recent" as const, games: fresh.games },
    { title: "Nobody agrees", note: "reviews split hardest", filter: "polarised" as const, games: split.games },
  ];
});

// L'illustration panoramique n'est qu'un appel à l'API du magasin Steam, mais
// elle ne change presque jamais pour un `appId` donné : la cacher évite de
// tâter Steam à chaque visite, et de retarder la page quand il traîne. Le `v2`
// de la clé écarte les URL de l'ancien hôte, que l'optimiseur refuse désormais.
function heroArt(appId: number) {
  return cached(`charts-hero-art-v2-${appId}`, () => resolveSteamHeroArt(appId))();
}

// Le héros ne pose pas l'illustration bord à bord comme la home : elle
// n'occupe que le flanc droit, et s'y fond par un dégradé plutôt que par un
// voile posé dessus.
const HERO_MASK =
  "linear-gradient(90deg,transparent 0%,rgba(0,0,0,0.12) 28%,rgba(0,0,0,0.5) 56%,rgba(0,0,0,0.85) 100%)";

function verdictColor(pct: number): string {
  if (pct >= 85) return "var(--status-good)";
  if (pct >= 60) return "var(--status-warning)";
  return "var(--status-critical)";
}

type ChartsPageProps = {
  searchParams: Promise<{ filter?: string; q?: string; page?: string }>;
};

export default async function ChartsPage({ searchParams }: ChartsPageProps) {
  const { filter: rawFilter, q: rawQuery, page: rawPage } = await searchParams;
  const filter: ChartFilterKey = isChartFilterKey(rawFilter) ? rawFilter : DEFAULT_CHART_FILTER;
  const query = rawQuery?.trim() || undefined;
  const page = Math.max(1, Number(rawPage) || 1);
  const active = chartFilter(filter);

  const [stats, languages, movers, ranking] = await Promise.all([
    siteStats(),
    languageScores(),
    topMover(),
    getCataloguePage({
      sort: filter,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      search: query,
      minReviews: active.minReviews,
    }),
  ]);

  // `trending` porte déjà sa variation ; pour les quatre autres tris, on la
  // complète pour les seules vignettes affichées.
  const games: CatalogueGame[] =
    filter === "trending"
      ? ranking.games
      : await getRecentDeltas(ranking.games.map((g) => g.appId)).then((deltas) =>
          ranking.games.map((g) => ({ ...g, deltaPct: deltas.get(g.appId) })),
        );

  // Les rubriques du haut sont un point d'entrée, pas un résultat : filtrer ou
  // tourner la page, c'est demander la grille — elles ne feraient alors que la
  // repousser sous la ligne de flottaison.
  const browsing = !query && page === 1;
  const rubrics = browsing ? await shelves() : [];

  const hero = movers.up[0];
  const art = hero ? await heroArt(hero.appId) : null;

  const totals = {
    reviews: stats.storedReviews,
    games: stats.totalGames,
    languages: languages.length,
  };

  return (
    <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
      <Nav variant="banded" active="charts" searchPlaceholder={`Search ${enFull.format(totals.games)} games…`} />
      <ScaleBand totals={totals} />

      {hero && (
        <div className="relative flex items-center overflow-hidden bg-[linear-gradient(115deg,#2a1206_0%,#0c1116_62%)] lg:min-h-[300px]">
          {art && (
            <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 hidden w-[52%] lg:block">
              {/* Le masque découvre l'illustration vers la droite : le texte
                  garde un fond plein, sans cadre ni couture. Il porte sur un
                  conteneur plutôt que sur l'image, dont `next/image` gère
                  lui-même les styles. */}
              <div
                className="absolute inset-0"
                style={{
                  maskImage: HERO_MASK,
                  WebkitMaskImage: HERO_MASK,
                }}
              >
                <Image src={art} alt="" fill sizes="52vw" priority className="object-cover object-[50%_34%]" />
              </div>
            </div>
          )}
          <div className="relative w-full px-6 py-[30px] sm:px-8 lg:max-w-[62%]">
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-brand-blue uppercase">
              <span>moving fastest in the catalogue · 30 days</span>
              <InfoHint
                text={
                  "Biggest gain in positive review share between the last 30 days and the 30 days before that, " +
                  "among games with at least 30 reviews in each window. The window ends on the most recent day of " +
                  "reviews we have loaded, not today."
                }
              />
            </div>
            <h1 className="mt-3 max-w-[18ch] text-4xl leading-[0.96] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-[46px]">
              {hero.name}
            </h1>
            <div className="mt-3.5 flex flex-wrap items-baseline gap-[18px] font-mono">
              <span
                className="text-[38px] leading-none"
                style={{ color: verdictColor(hero.recentPctPositive * 100) }}
              >
                {Math.round(hero.recentPctPositive * 100)}%
              </span>
              <span
                className="text-[15px]"
                style={{ color: hero.deltaPct >= 0 ? "var(--status-good)" : "var(--status-critical)" }}
              >
                {hero.deltaPct >= 0 ? "+" : ""}
                {hero.deltaPct.toFixed(1)} pts
              </span>
              <span className="text-xs text-[#9fb2bd]">
                {enFull.format(hero.recentReviews)} reviews in that window
              </span>
            </div>
            <p className="mt-3.5 max-w-[48ch] text-base leading-relaxed text-[#cfdae1]">
              Nothing in the catalogue moved this much in thirty days: its positive share went from{" "}
              {Math.round(hero.previousPctPositive * 100)}% to {Math.round(hero.recentPctPositive * 100)}%.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link
                href={`/games/${hero.appId}`}
                className="rounded-full bg-brand-blue px-[18px] py-2.5 text-sm font-bold text-[#0c1116]"
              >
                Read the reviews
              </Link>
              <Link
                href="/battle"
                className="rounded-full border border-[#24333f] bg-[#0c1116]/60 px-[18px] py-2.5 text-sm font-semibold text-[#cfdae1] backdrop-blur-sm"
              >
                Compare it in Battle
              </Link>
            </div>
          </div>
        </div>
      )}

      {rubrics.length > 0 && (
        <div className="border-t border-[#1a2530] px-6 pt-7 pb-2 sm:px-8">
          <div className="mx-auto max-w-[1320px]">
            {rubrics.map((shelf) => (
              <div key={shelf.title} className="mb-7">
                <SectionHead
                  title={shelf.title}
                  note={shelf.note}
                  action={
                    <Link
                      href={chartsHref({ filter: shelf.filter })}
                      className="font-mono text-[10px] tracking-[0.12em] text-brand-blue uppercase"
                    >
                      see all →
                    </Link>
                  }
                />
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                  {shelf.games.map((game) => (
                    <ShelfTile key={game.appId} game={game} sizes="(min-width: 1024px) 12vw, 30vw" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-[#1a2530] px-6 pt-7 pb-10 sm:px-8">
        <div className="mx-auto max-w-[1320px]">
          <SectionHead
            title="All games"
            note={`${active.note} · ${enFull.format(games.length)} shown`}
            action={
              <ChartsFilterForm filter={filter} defaultValue={query} className="w-full max-w-[320px]" />
            }
          />

          <div className="flex flex-wrap gap-2 border-b border-[#16202a] pb-4">
            {CHART_FILTERS.map((f) => (
              <Link
                key={f.key}
                href={chartsHref({ filter: f.key, q: query })}
                aria-current={f.key === filter ? "page" : undefined}
                className={
                  f.key === filter
                    ? "rounded-full border border-brand-blue bg-brand-blue px-3.5 py-1.5 text-xs font-semibold text-[#0c1116]"
                    : "rounded-full border border-[#24333f] px-3.5 py-1.5 text-xs font-semibold text-[#9fb2bd] hover:border-white/30 hover:text-[#eef2f4]"
                }
              >
                {f.label}
              </Link>
            ))}
          </div>

          {games.length === 0 ? (
            <p className="mt-6 text-sm text-[#9fb2bd]">
              {query ? (
                <>
                  No game matches “{query}” in this ranking.{" "}
                  <Link href={chartsHref({ filter })} className="text-brand-blue hover:underline">
                    Clear the filter →
                  </Link>
                </>
              ) : (
                "No game on this page."
              )}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3.5 pt-5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
              {games.map((game) => (
                <CatalogueTile key={game.appId} game={game} sizes="(min-width: 1024px) 12vw, 30vw" />
              ))}
            </div>
          )}

          {(page > 1 || ranking.hasNext) && (
            <nav className="mt-7 flex items-center justify-between gap-3 text-xs" aria-label="Pagination">
              {page > 1 ? (
                <Link
                  href={chartsHref({ filter, q: query, page: page - 1 })}
                  className="rounded-full border border-[#24333f] px-4 py-2 text-[#9fb2bd] hover:border-white/30"
                >
                  ← Previous
                </Link>
              ) : (
                <span className="rounded-full border border-[#1a2530] px-4 py-2 text-[#3a4750]">← Previous</span>
              )}
              <span className="font-mono text-[#5f7481]">Page {page}</span>
              {ranking.hasNext ? (
                <Link
                  href={chartsHref({ filter, q: query, page: page + 1 })}
                  className="rounded-full border border-[#24333f] px-4 py-2 text-[#9fb2bd] hover:border-white/30"
                >
                  Next →
                </Link>
              ) : (
                <span className="rounded-full border border-[#1a2530] px-4 py-2 text-[#3a4750]">Next →</span>
              )}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
