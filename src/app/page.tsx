import { cache, Suspense } from "react";
import { unstable_cache } from "next/cache";
import Link from "next/link";
import { BBCodeText } from "@/components/BBCodeText";
import { ChartRow, ChartRowHeader } from "@/components/ChartRow";
import { GameCoverTile } from "@/components/GameCoverTile";
import { GameSearchForm } from "@/components/GameSearchForm";
import { HeroShelf } from "@/components/HeroShelf";
import { Nav } from "@/components/Nav";
import { Skeleton } from "@/components/Skeleton";
import {
  getLanguageReviewScores,
  getReviewDuel,
  getSiteStats,
  getTopGames,
  getTrendingGames,
} from "@/lib/data/gameData";

// La review du jour est tirée au sort à chaque visite, donc la page reste
// dynamique ; les agrégats coûteux sont cachés individuellement ci-dessous.
export const dynamic = "force-dynamic";

const enCompact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const enFull = new Intl.NumberFormat("en-US");

const CHART_FILTERS = [
  { label: "Trending", href: "/classements" },
  { label: "Best rated", href: "/classements?filter=mieux-notes" },
  { label: "Most reviewed", href: "/classements?filter=plus-commentes" },
  { label: "Worst rated", href: "/classements?filter=pires-notes" },
] as const;

const SHELF_SIZE = 10;
const CHART_SIZE = 5;

// L'étagère et les charts lisent la même comparaison 30j/30j : `cache` la
// déduplique au sein d'une requête, `unstable_cache` évite de la recalculer à
// chaque visiteur. C'est de loin la requête la plus lourde de la page, et son
// contenu ne bouge qu'au rythme du pipeline.
const trending = cache(
  unstable_cache(() => getTrendingGames(SHELF_SIZE / 2), ["home-trending"], { revalidate: 900 }),
);

// Deux sections affichent ces totaux ; une seule requête doit suffire.
const siteStats = cache(getSiteStats);

async function HeroCopy() {
  const [stats, languages] = await Promise.all([siteStats(), getLanguageReviewScores()]);

  return (
    <div className="mt-4 grid grid-cols-1 items-end gap-8 lg:grid-cols-[minmax(0,620px)_minmax(0,1fr)] lg:gap-10">
      <div>
        <h1 className="m-0 text-4xl leading-[0.95] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-[56px]">
          {enCompact.format(stats.totalReviews)} reviews,{" "}
          <span className="text-brand-blue">one shelf.</span>
        </h1>
        <p className="mt-4 max-w-[50ch] text-base leading-relaxed text-[#9fb2bd]">
          Every cover hangs at its real approval rating. Below: the charts, the full
          catalogue, and what players actually wrote.
        </p>
        <GameSearchForm placeholder={`Search ${enFull.format(stats.totalGames)} games…`} className="mt-5 max-w-[420px]" />
      </div>
      <div className="flex justify-start gap-8 pb-1.5 font-mono lg:justify-end">
        <div>
          <div className="text-2xl font-medium">{enCompact.format(stats.totalReviews)}</div>
          <div className="text-[10px] tracking-[0.12em] text-[#7d919c] uppercase">reviews</div>
        </div>
        <div>
          <div className="text-2xl font-medium">{enFull.format(stats.totalGames)}</div>
          <div className="text-[10px] tracking-[0.12em] text-[#7d919c] uppercase">games</div>
        </div>
        <div>
          <div className="text-2xl font-medium">{languages.length}</div>
          <div className="text-[10px] tracking-[0.12em] text-[#7d919c] uppercase">languages</div>
        </div>
      </div>
    </div>
  );
}

function HeroCopyFallback() {
  return (
    <div className="mt-4 grid grid-cols-1 items-end gap-8 lg:grid-cols-[minmax(0,620px)_minmax(0,1fr)] lg:gap-10">
      <div>
        <Skeleton className="h-[54px] w-full max-w-[560px] sm:h-[60px] lg:h-[106px]" />
        <Skeleton className="mt-4 h-12 w-full max-w-[50ch]" />
        <Skeleton className="mt-5 h-10 w-full max-w-[420px]" />
      </div>
      <div className="flex justify-start gap-8 pb-1.5 lg:justify-end">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <Skeleton className="h-8 w-16" />
            <Skeleton className="mt-1 h-2.5 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

async function Shelf() {
  const { up, down } = await trending();

  const games = [...up, ...down]
    .map((g) => ({
      appId: g.appId,
      name: g.name,
      coverUrl: g.coverUrl,
      pct: g.recentPctPositive * 100,
      deltaPct: g.deltaPct,
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, SHELF_SIZE);

  return <HeroShelf games={games} />;
}

function ShelfFallback() {
  return <div className="mt-4 h-[300px] sm:h-[380px] lg:h-[430px]" />;
}

function SectionHeading({ number, title, note, action }: {
  number: string;
  title: string;
  note: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[11px] text-brand-blue">{number}</span>
        <h2 className="m-0 text-2xl font-extrabold tracking-tight sm:text-[26px]">{title}</h2>
        <span className="text-sm text-[#7d919c]">{note}</span>
      </div>
      {action}
    </div>
  );
}

async function Charts() {
  const { up } = await trending();

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <ChartRowHeader reviewsLabel="reviews 30d" positiveLabel="positive" shiftLabel="shift" />
        {up.slice(0, CHART_SIZE).map((game, i) => (
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
  );
}

function ChartsFallback() {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px] space-y-2">
        {Array.from({ length: CHART_SIZE }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}

async function GamesGrid() {
  const games = await getTopGames(20);

  return (
    <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
      {games.map((game) => (
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
  );
}

function GamesGridFallback() {
  return (
    <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
      {Array.from({ length: 20 }, (_, i) => (
        <Skeleton key={i} className="aspect-[2/3] w-full rounded-[3px]" />
      ))}
    </div>
  );
}

async function GamesCount() {
  const stats = await siteStats();
  return <>{enFull.format(stats.totalGames)} tracked, hover for the numbers</>;
}

async function Duel() {
  const duel = await getReviewDuel();
  if (!duel) return null;

  return (
    <div className="border-t border-[#1a2530] bg-[#0e141a] px-5 py-9 sm:px-7">
      <div className="mx-auto max-w-[1320px]">
        <SectionHeading number="03" title="Two sides" note="one game, two players, no middle ground" />
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
  );
}

// Chaque section attend sa propre requête : la plus lente ne retient plus les
// autres, et la coquille (nav, titres, gabarit) part avant toute lecture SQL.
export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-7">
        <Nav />
        <Suspense fallback={<HeroCopyFallback />}>
          <HeroCopy />
        </Suspense>
        <Suspense fallback={<ShelfFallback />}>
          <Shelf />
        </Suspense>
      </div>

      <div className="border-t border-[#1a2530] px-5 py-9 sm:px-7">
        <div className="mx-auto max-w-[1320px]">
          <SectionHeading
            number="01"
            title="Charts"
            note="rising over 30 days · 30-review floor"
            action={
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
            }
          />
          <Suspense fallback={<ChartsFallback />}>
            <Charts />
          </Suspense>
        </div>
      </div>

      <div className="border-t border-[#1a2530] px-5 py-9 sm:px-7">
        <div className="mx-auto max-w-[1320px]">
          <SectionHeading
            number="02"
            title="Games"
            note={
              <Suspense fallback={<Skeleton className="inline-block h-3 w-64 align-middle" />}>
                <GamesCount />
              </Suspense>
            }
            action={
              <Link href="/games" className="font-mono text-[10px] tracking-[0.12em] text-brand-blue uppercase">
                browse all →
              </Link>
            }
          />
          <Suspense fallback={<GamesGridFallback />}>
            <GamesGrid />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={null}>
        <Duel />
      </Suspense>
    </div>
  );
}
