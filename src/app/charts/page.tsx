import Link from "next/link";
import { ChartRow, ChartRowHeader } from "@/components/ChartRow";
import { Nav } from "@/components/Nav";
import { getRankedGames, getTopGames, getTrendingGames } from "@/lib/data/gameData";

const FILTERS = [
  { key: "trending", label: "Trending" },
  { key: "best-rated", label: "Best rated" },
  { key: "most-reviewed", label: "Most reviewed" },
  { key: "worst-rated", label: "Worst rated" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const RANKING_LIMIT = 20;
const MIN_REVIEWS_FOR_RATING = 500;

function isFilterKey(value: string | undefined): value is FilterKey {
  return FILTERS.some((f) => f.key === value);
}

const enFull = new Intl.NumberFormat("en-US");

type ChartsPageProps = {
  searchParams: Promise<{ filter?: string }>;
};

export default async function ChartsPage({ searchParams }: ChartsPageProps) {
  const { filter: rawFilter } = await searchParams;
  const filter: FilterKey = isFilterKey(rawFilter) ? rawFilter : "trending";

  const rows =
    filter === "trending"
      ? (await getTrendingGames(RANKING_LIMIT)).up.map((g, i) => ({
          rank: i + 1,
          appId: g.appId,
          name: g.name,
          coverUrl: g.coverUrl,
          reviews: enFull.format(g.recentReviews),
          pct: g.recentPctPositive * 100,
          delta: { formatted: `${g.deltaPct >= 0 ? "+" : ""}${g.deltaPct.toFixed(1)}`, rising: g.deltaPct >= 0 },
        }))
      : (
          filter === "best-rated"
            ? await getRankedGames("best", RANKING_LIMIT, MIN_REVIEWS_FOR_RATING)
            : filter === "worst-rated"
              ? await getRankedGames("worst", RANKING_LIMIT, MIN_REVIEWS_FOR_RATING)
              : await getTopGames(RANKING_LIMIT)
        ).map((g, i) => ({
          rank: i + 1,
          appId: g.appId,
          name: g.name,
          coverUrl: g.coverUrl,
          reviews: enFull.format(g.totalReviews),
          pct: g.pctPositive * 100,
          delta: undefined,
        }));

  return (
    <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-7">
        <Nav />

        <h1 className="mt-8 text-2xl font-extrabold tracking-tight">Charts</h1>
        <p className="mt-1 text-sm text-[#9fb2bd]">
          {filter === "trending"
            ? "Biggest gains in positive review share over the last 30 days."
            : `Limited to games with at least ${MIN_REVIEWS_FOR_RATING} reviews, so a thin sample cannot skew the ranking.`}
        </p>

        <div className="mt-5 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={f.key === "trending" ? "/charts" : `/charts?filter=${f.key}`}
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
              reviewsLabel={filter === "trending" ? "reviews 30d" : "total reviews"}
              positiveLabel="positive"
              shiftLabel="shift"
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
