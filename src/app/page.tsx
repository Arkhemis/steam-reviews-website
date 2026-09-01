import Link from "next/link";
import { BBCodeText } from "@/components/BBCodeText";
import { ChartRow, ChartRowHeader } from "@/components/ChartRow";
import { GameCoverTile } from "@/components/GameCoverTile";
import { GameSearchForm } from "@/components/GameSearchForm";
import { HeroShelf } from "@/components/HeroShelf";
import { Nav } from "@/components/Nav";
import {
  getLanguageReviewScores,
  getReviewDuel,
  getSiteStats,
  getTopGames,
  getTrendingGames,
} from "@/lib/data/gameData";

// Les données (tendances, review du jour) viennent de Postgres et doivent être
// à jour à chaque requête ; la DB n'est de toute façon pas joignable au build
// (image buildée hors du réseau docker compose).
export const dynamic = "force-dynamic";

const enCompact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const enFull = new Intl.NumberFormat("en-US");

const CHART_FILTERS = [
  { label: "Trending", href: "/classements" },
  { label: "Best rated", href: "/classements?filter=mieux-notes" },
  { label: "Most reviewed", href: "/classements?filter=plus-commentes" },
  { label: "Worst rated", href: "/classements?filter=pires-notes" },
] as const;

export default async function HomePage() {
  const [siteStats, languages, rising, falling, topGames, duel] = await Promise.all([
    getSiteStats(),
    getLanguageReviewScores(),
    getTrendingGames("up", 5),
    getTrendingGames("down", 5),
    getTopGames(20),
    getReviewDuel(),
  ]);

  const shelfGames = [...rising, ...falling]
    .map((g) => ({
      appId: g.appId,
      name: g.name,
      coverUrl: g.coverUrl,
      pct: g.recentPctPositive * 100,
      deltaPct: g.deltaPct,
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 10);

  return (
    <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-7">
        <Nav />

        <div className="mt-4 grid grid-cols-1 items-end gap-8 lg:grid-cols-[minmax(0,620px)_minmax(0,1fr)] lg:gap-10">
          <div>
            <h1 className="m-0 text-4xl leading-[0.95] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-[56px]">
              {enCompact.format(siteStats.totalReviews)} reviews,{" "}
              <span className="text-brand-blue">one shelf.</span>
            </h1>
            <p className="mt-4 max-w-[50ch] text-base leading-relaxed text-[#9fb2bd]">
              Every cover hangs at its real approval rating. Below: the charts, the full
              catalogue, and what players actually wrote.
            </p>
            <GameSearchForm placeholder={`Search ${enFull.format(siteStats.totalGames)} games…`} className="mt-5 max-w-[420px]" />
          </div>
          <div className="flex justify-start gap-8 pb-1.5 font-mono lg:justify-end">
            <div>
              <div className="text-2xl font-medium">{enCompact.format(siteStats.totalReviews)}</div>
              <div className="text-[10px] tracking-[0.12em] text-[#7d919c] uppercase">reviews</div>
            </div>
            <div>
              <div className="text-2xl font-medium">{enFull.format(siteStats.totalGames)}</div>
              <div className="text-[10px] tracking-[0.12em] text-[#7d919c] uppercase">games</div>
            </div>
            <div>
              <div className="text-2xl font-medium">{languages.length}</div>
              <div className="text-[10px] tracking-[0.12em] text-[#7d919c] uppercase">languages</div>
            </div>
          </div>
        </div>

        <HeroShelf games={shelfGames} />
      </div>

      <div className="border-t border-[#1a2530] px-5 py-9 sm:px-7">
        <div className="mx-auto max-w-[1320px]">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[11px] text-brand-blue">01</span>
              <h2 className="m-0 text-2xl font-extrabold tracking-tight sm:text-[26px]">Charts</h2>
              <span className="text-sm text-[#7d919c]">rising over 30 days · 30-review floor</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CHART_FILTERS.map((f) => (
                <Link
                  key={f.label}
                  href={f.href}
                  className="rounded-full border border-[#24333f] px-3 py-1 text-xs font-semibold text-[#9fb2bd]"
                >
                  {f.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[560px]">
              <ChartRowHeader reviewsLabel="reviews 30d" positiveLabel="positive" shiftLabel="shift" />
              {rising.map((game, i) => (
                <ChartRow
                  key={game.appId}
                  rank={i + 1}
                  appId={game.appId}
                  name={game.name}
                  coverUrl={game.coverUrl}
                  reviews={enFull.format(game.recentReviews)}
                  pct={game.recentPctPositive * 100}
                  delta={{
                    formatted: `${game.deltaPct >= 0 ? "+" : ""}${game.deltaPct.toFixed(1)}`,
                    rising: game.deltaPct >= 0,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[#1a2530] px-5 py-9 sm:px-7">
        <div className="mx-auto max-w-[1320px]">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[11px] text-brand-blue">02</span>
              <h2 className="m-0 text-2xl font-extrabold tracking-tight sm:text-[26px]">Games</h2>
              <span className="text-sm text-[#7d919c]">
                {enFull.format(siteStats.totalGames)} tracked, hover for the numbers
              </span>
            </div>
            <Link href="/games" className="font-mono text-[10px] tracking-[0.12em] text-brand-blue uppercase">
              browse all →
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
            {topGames.map((game) => (
              <GameCoverTile
                key={game.appId}
                appId={game.appId}
                name={game.name}
                coverUrl={game.coverUrl}
                pct={game.pctPositive * 100}
                reviews={game.totalReviews}
                sizes="10vw"
              />
            ))}
          </div>
        </div>
      </div>

      {duel && (
        <div className="border-t border-[#1a2530] bg-[#0e141a] px-5 py-9 sm:px-7">
          <div className="mx-auto max-w-[1320px]">
            <div className="mb-4 flex items-baseline gap-3">
              <span className="font-mono text-[11px] text-brand-blue">03</span>
              <h2 className="m-0 text-2xl font-extrabold tracking-tight sm:text-[26px]">Two sides</h2>
              <span className="text-sm text-[#7d919c]">one game, two players, no middle ground</span>
            </div>
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              {[duel.positive, duel.negative].map(({ game, review }) => (
                <div
                  key={review.recommendationId}
                  className="rounded-[5px] border border-[#1e2b36] p-5"
                  style={{ borderLeft: `3px solid ${review.votedUp ? "var(--status-good)" : "var(--status-critical)"}` }}
                >
                  <div className="line-clamp-6 text-[17px] leading-relaxed text-[#dfe7eb]">
                    <BBCodeText text={review.reviewText} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 font-mono text-[11px] text-[#7d919c]">
                    <span>
                      {review.authorPersonaname} ·{" "}
                      <Link href={`/games/${game.appId}`} className="hover:underline">
                        {game.name}
                      </Link>{" "}
                      · {Math.round(review.authorPlaytimeAtReviewMinutes / 60)}h
                    </span>
                    <span>{enFull.format(review.votesUp)} helpful</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
