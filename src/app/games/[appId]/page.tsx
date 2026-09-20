import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { DigDeeper, SectionHead, type Door } from "@/components/HomeEditorial";
import { InfoHint } from "@/components/InfoHint";
import { Nav } from "@/components/Nav";
import { StatTile } from "@/components/StatTile";
import { CHART_FILTERS } from "@/lib/charts";
import { LANGUAGE_LABELS } from "@/lib/map";
import { getGameStats } from "@/lib/data/gameData";
import type { GameStats } from "@/lib/data/types";
import {
  CoverageBand,
  CoverageBandSkeleton,
  HeroArt,
  LanguagesSection,
  LanguagesSkeleton,
  ReviewsSection,
  ReviewsSkeleton,
  TrendsHeading,
  TrendsSection,
  TrendsSkeleton,
  VolumeSection,
  VolumeSkeleton,
} from "./sections";

type GamePageProps = {
  params: Promise<{ appId: string }>;
  searchParams: Promise<{ lang?: string }>;
};

const enFull = new Intl.NumberFormat("en-US");

// Le nombre de langues que la carte sait nommer : c'est ce qu'elle promet
// d'ouvrir, et rien ici n'a le compte du jeu sous la main sans une requête de
// plus — celle du bandeau, qui vit dans sa propre boundary.
const MAPPED_LANGUAGES = Object.keys(LANGUAGE_LABELS).length;

function getSteamRating(pctPositive: number, totalReviews: number): { label: string; color: string } {
  const pct = pctPositive * 100;

  if (pct < 20) {
    if (totalReviews >= 500) return { label: "Overwhelmingly Negative", color: "var(--status-critical)" };
    if (totalReviews >= 50) return { label: "Very Negative", color: "var(--status-critical)" };
    return { label: "Negative", color: "var(--status-critical)" };
  }
  if (pct < 40) return { label: "Mostly Negative", color: "var(--status-critical)" };
  if (pct < 70) return { label: "Mixed", color: "var(--status-warning)" };
  if (pct < 80) return { label: "Mostly Positive", color: "var(--status-good)" };
  if (totalReviews >= 500) return { label: "Overwhelmingly Positive", color: "var(--status-good)" };
  if (totalReviews >= 50) return { label: "Very Positive", color: "var(--status-good)" };
  return { label: "Positive", color: "var(--status-good)" };
}

function releaseLine(stats: GameStats): string {
  const released = stats.firstReleaseDate
    ? `released ${new Date(`${stats.firstReleaseDate}T00:00:00Z`).toLocaleDateString("en-US", {
        timeZone: "UTC",
        day: "numeric",
        month: "short",
        year: "numeric",
      })}`
    : null;

  return [stats.developers.join(", ") || null, released].filter(Boolean).join(" · ");
}

function doorsFor(stats: GameStats): Door[] {
  return [
    {
      kicker: "compare",
      title: "Battle",
      blurb: `Put ${stats.name} head to head with another game — score, playtime, refunds, both camps.`,
      stat: "1v1",
      statLabel: "side by side",
      href: `/battle?game=${stats.appId}`,
    },
    {
      kicker: "by language",
      title: "Language map",
      blurb: "The same game rarely scores the same in English and in Simplified Chinese. See where it lands.",
      stat: String(MAPPED_LANGUAGES),
      statLabel: "languages",
      href: `/map?app=${stats.appId}`,
    },
    {
      kicker: "browse",
      title: "All lists",
      blurb: "Most reviewed, best and worst rated, trending, most polarised, recently released.",
      stat: String(CHART_FILTERS.length),
      statLabel: "rankings",
      href: "/charts",
    },
  ];
}

export default async function GamePage({ params, searchParams }: GamePageProps) {
  const { appId } = await params;
  const { lang } = await searchParams;
  const numericAppId = Number(appId);

  const stats = await getGameStats(numericAppId);

  if (!stats) {
    return (
      <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
        <Nav variant="banded" active="games" />
        <p className="mt-12 text-center text-[#9fb2bd]">This game was not found.</p>
      </div>
    );
  }

  // Only `getGameStats` is awaited here: it decides between the page and the
  // 404, and feeds the hero. Every other query runs inside its own Suspense
  // boundary below, so the hero reaches the browser without waiting on the
  // review set — ni sur le CDN de Steam pour l'illustration.
  const rating = getSteamRating(stats.pctPositive, stats.totalReviews);
  const tags = stats.genres.slice(0, 3);

  return (
    <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
      <Nav variant="banded" active="games" />
      <Suspense fallback={<CoverageBandSkeleton />}>
        <CoverageBand appId={numericAppId} />
      </Suspense>

      <div className="relative flex items-center overflow-hidden bg-[linear-gradient(115deg,#2a1206_0%,#0c1116_62%)] lg:min-h-[440px]">
        <Suspense fallback={null}>
          <HeroArt appId={numericAppId} />
        </Suspense>

        <div className="relative grid w-full grid-cols-[100px_minmax(0,1fr)] items-center gap-5 px-6 py-10 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-7 sm:px-8 lg:max-w-[62%] lg:py-12">
          {/* Le liseré coloré en haut de la jaquette rejoue le verdict, comme
              sur les vignettes du catalogue. */}
          <span className="relative block aspect-[2/3] overflow-hidden rounded-[4px] bg-white/5 shadow-[0_18px_50px_rgba(0,0,0,0.55)]">
            {stats.coverUrl && (
              // The LCP element on this route: served through the image optimizer
              // like every other cover, but eagerly — lazy-loading the largest
              // above-the-fold image would only delay it.
              <Image src={stats.coverUrl} alt="" fill sizes="150px" priority className="object-cover" />
            )}
            <span className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: rating.color }} />
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-brand-blue uppercase">
              <span>{rating.label.toLowerCase()} · since release</span>
              <InfoHint
                text={
                  "Share of every review Steam counts for this game that is positive, since release. " +
                  "The curve below only judges the reviews written in each month."
                }
              />
            </div>
            <h1 className="mt-2.5 max-w-[18ch] text-4xl leading-[0.94] font-extrabold tracking-tight text-balance drop-shadow-[0_2px_24px_rgba(12,17,22,0.9)] sm:text-5xl lg:text-[56px]">
              {stats.name}
            </h1>
            <div className="mt-3.5 flex flex-wrap items-center gap-x-[18px] gap-y-2 font-mono">
              <span className="text-[44px] leading-none" style={{ color: rating.color }}>
                {Math.round(stats.pctPositive * 100)}%
              </span>
              <span className="text-xs leading-relaxed text-[#9fb2bd]">
                {enFull.format(stats.totalReviews)} reviews on Steam
                <br />
                {releaseLine(stats)}
              </span>
            </div>
            {tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[#24333f] bg-[#0c1116]/60 px-3 py-1 font-mono text-[10px] tracking-[0.1em] text-[#cfdae1] uppercase"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-5 flex flex-wrap gap-2.5">
              <a
                href="#reviews"
                className="rounded-full bg-brand-blue px-[18px] py-2.5 text-sm font-bold text-[#0c1116]"
              >
                Read the reviews
              </a>
              <a
                href={`https://store.steampowered.com/app/${stats.appId}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-[#24333f] bg-[#0c1116]/60 px-[18px] py-2.5 text-sm font-semibold text-[#cfdae1] backdrop-blur-sm"
              >
                View on Steam ↗
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Bandeau de KPI, à fond perdu comme le pouls de la home : les trois
          chiffres de droite viennent de `game_stats`, seules les barres de
          gauche demandent une requête — d'où leur boundary. */}
      <div className="grid grid-cols-2 border-y border-[#1a2530] lg:grid-cols-4">
        <div className="border-r border-[#16202a] px-5 py-4">
          <div className="font-mono text-[9px] tracking-[0.12em] text-[#7d919c] uppercase">reviews / day · 31d</div>
          <div className="mt-2">
            <Suspense fallback={<VolumeSkeleton />}>
              <VolumeSection appId={numericAppId} />
            </Suspense>
          </div>
        </div>
        <StatTile
          label="median playtime"
          value={`${Math.round(stats.playtimeMedianMinutes / 60)}h`}
          note="all time, per reviewer"
          className="lg:border-r lg:border-[#16202a]"
        />
        <StatTile
          label="steam deck"
          value={`${Math.round(stats.pctSteamDeck * 100)}%`}
          note="played mostly on Deck"
          className="border-r border-[#16202a]"
        />
        <StatTile
          label="refunded"
          value={`${(stats.pctRefunded * 100).toFixed(1)}%`}
          note="of reviewers"
        />
      </div>

      <div className="border-b border-[#1a2530] px-6 py-4 sm:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-mono text-[9px] tracking-[0.12em] text-[#7d919c] uppercase">reviews by language</span>
          <Link
            href={`/map?app=${stats.appId}`}
            className="font-mono text-[10px] tracking-[0.12em] text-brand-blue uppercase"
          >
            see it on the map →
          </Link>
        </div>
        <Suspense fallback={<LanguagesSkeleton />}>
          <LanguagesSection appId={numericAppId} />
        </Suspense>
      </div>

      <div className="px-6 py-8 sm:px-8">
        <div className="mx-auto max-w-[1320px]">
          <TrendsHeading />
          <Suspense fallback={<TrendsSkeleton />}>
            <TrendsSection appId={numericAppId} />
          </Suspense>
        </div>
      </div>

      <div id="reviews" className="border-t border-[#1a2530] px-6 py-8 sm:px-8">
        <div className="mx-auto max-w-[1320px]">
          <SectionHead title="Both camps" note="the most upvoted review on each side" />
          {/* Clé sur la langue : changer de langue remonte la boundary, donc le
              skeleton revient au lieu de figer la paire précédente pendant la
              requête. */}
          <Suspense key={lang ?? "default"} fallback={<ReviewsSkeleton />}>
            <ReviewsSection appId={numericAppId} lang={lang} />
          </Suspense>
        </div>
      </div>

      <DigDeeper title="Keep digging" note="three ways out of this page" doors={doorsFor(stats)} />
    </div>
  );
}
