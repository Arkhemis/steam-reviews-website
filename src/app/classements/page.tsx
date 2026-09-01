import Link from "next/link";
import { ChartRow, ChartRowHeader } from "@/components/ChartRow";
import { Nav } from "@/components/Nav";
import { getRankedGames, getTopGames, getTrendingGames } from "@/lib/data/gameData";

const FILTERS = [
  { key: "tendances", label: "Tendances" },
  { key: "mieux-notes", label: "Mieux notés" },
  { key: "plus-commentes", label: "Plus commentés" },
  { key: "pires-notes", label: "Pires notes" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const RANKING_LIMIT = 20;
const MIN_REVIEWS_FOR_RATING = 500;

function isFilterKey(value: string | undefined): value is FilterKey {
  return FILTERS.some((f) => f.key === value);
}

const frFull = new Intl.NumberFormat("fr-FR");

type ClassementsPageProps = {
  searchParams: Promise<{ filter?: string }>;
};

export default async function ClassementsPage({ searchParams }: ClassementsPageProps) {
  const { filter: rawFilter } = await searchParams;
  const filter: FilterKey = isFilterKey(rawFilter) ? rawFilter : "tendances";

  const rows =
    filter === "tendances"
      ? (await getTrendingGames("up", RANKING_LIMIT)).map((g, i) => ({
          rank: i + 1,
          appId: g.appId,
          name: g.name,
          coverUrl: g.coverUrl,
          reviews: frFull.format(g.recentReviews),
          pct: g.recentPctPositive * 100,
          delta: { formatted: `${g.deltaPct >= 0 ? "+" : ""}${g.deltaPct.toFixed(1)}`, rising: g.deltaPct >= 0 },
        }))
      : (
          filter === "mieux-notes"
            ? await getRankedGames("best", RANKING_LIMIT, MIN_REVIEWS_FOR_RATING)
            : filter === "pires-notes"
              ? await getRankedGames("worst", RANKING_LIMIT, MIN_REVIEWS_FOR_RATING)
              : await getTopGames(RANKING_LIMIT)
        ).map((g, i) => ({
          rank: i + 1,
          appId: g.appId,
          name: g.name,
          coverUrl: g.coverUrl,
          reviews: frFull.format(g.totalReviews),
          pct: g.pctPositive * 100,
          delta: undefined,
        }));

  return (
    <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-7">
        <Nav />

        <h1 className="mt-8 text-2xl font-extrabold tracking-tight">Classements</h1>
        <p className="mt-1 text-sm text-[#9fb2bd]">
          {filter === "tendances"
            ? "Plus forte progression du taux d'avis positifs sur les 30 derniers jours."
            : `Sur les jeux avec au moins ${MIN_REVIEWS_FOR_RATING} reviews, pour éviter qu'un petit volume ne fausse le classement.`}
        </p>

        <div className="mt-5 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={f.key === "tendances" ? "/classements" : `/classements?filter=${f.key}`}
              className={
                f.key === filter
                  ? "rounded-full bg-brand-blue px-3 py-1 text-xs font-bold text-black"
                  : "rounded-full border border-[#24333f] px-3 py-1 text-xs font-semibold text-[#9fb2bd]"
              }
            >
              {f.label}
            </Link>
          ))}
        </div>

        <div className="mt-6 overflow-x-auto">
          <div className="min-w-[560px]">
            <ChartRowHeader
              reviewsLabel={filter === "tendances" ? "avis 30j" : "avis total"}
              positiveLabel="positif"
              shiftLabel="évolution"
            />
            {rows.map((row) => (
              <ChartRow key={row.appId} {...row} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
