import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { DigDeeper, SectionHead, type Door } from "@/components/HomeEditorial";
import { InfoHint } from "@/components/InfoHint";
import { Nav } from "@/components/Nav";
import { StatTile } from "@/components/StatTile";
import { CHART_FILTERS } from "@/lib/charts";
import { LANGUAGE_LABELS } from "@/lib/map";
import { estimateRevenue } from "@/lib/revenue";
import { getGameStats } from "@/lib/data/gameData";
import type { GameProfile, GameStats, GameStoreListing, SteamAppType } from "@/lib/data/types";
import {
  CoverageBand,
  CoverageBandSkeleton,
  DlcSection,
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
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const enCompact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/**
 * La tuile de revenu estimé : un ordre de grandeur, d'où le « ~ » et la note
 * qui rappelle combien de copies par avis le calcul suppose.
 */
function revenueTile(stats: GameProfile): { value: string; note: string } {
  const estimate = stats.store
    ? estimateRevenue({
        totalReviews: stats.totalReviews,
        priceUsd: stats.store.priceUsd,
        isFree: stats.store.isFree,
        firstReleaseDate: stats.firstReleaseDate,
      })
    : null;
  if (estimate) {
    return {
      value: `~${usdCompact.format(estimate.grossRevenueUsd)}`,
      note: `~${enCompact.format(estimate.unitsSold)} copies · ${estimate.multiplier} per review`,
    };
  }
  return { value: "—", note: stats.store?.isFree ? "free to play" : "no price on Steam" };
}

// « game » n'apprend rien sur la fiche d'un jeu, et « other » mélange
// playtests, logiciels et vidéos : seuls les autres types méritent un badge.
const APP_TYPE_LABELS: Partial<Record<SteamAppType, string>> = {
  dlc: "DLC",
  demo: "Demo",
  mod: "Mod",
  music: "Soundtrack",
};

type StoreBadge = { label: string; color?: string; fill?: { background: string; border: string } };

// Les aplats que le store Steam donne à ses propres bandeaux — le violet de
// `.game_area_dlc_bubble`, l'or de `.game_area_mod_bubble`, le bleu de
// `.early_access_header` — pour qu'un habitué reconnaisse le statut avant même
// de lire le badge.
const STEAM_DLC_BADGE: Omit<StoreBadge, "label"> = {
  color: "#d5d6d8",
  fill: {
    background: "linear-gradient(-60deg, rgba(72,23,70,0.8) 10%, rgba(165,84,177,0.8) 100%)",
    border: "rgba(165,84,177,0.8)",
  },
};
// Steam écrit en gris clair sur son or, illisible à cette taille : le texte
// passe au fond du site, l'aplat reste celui de Steam.
const STEAM_MOD_BADGE: Omit<StoreBadge, "label"> = {
  color: "#0c1116",
  fill: {
    background: "linear-gradient(-45deg, rgba(190,150,25,0.6) 10%, rgba(224,177,29,0.8) 100%)",
    border: "rgba(224,177,29,0.8)",
  },
};
const STEAM_TYPE_BADGES: Partial<Record<SteamAppType, Omit<StoreBadge, "label">>> = {
  dlc: STEAM_DLC_BADGE,
  mod: STEAM_MOD_BADGE,
};
const STEAM_EARLY_ACCESS_BADGE: Omit<StoreBadge, "label"> = {
  color: "#b8e0fd",
  fill: { background: "linear-gradient(to right, #27475d, #4e81ae)", border: "#4e81ae" },
};

/**
 * Ce que la fiche store dit du jeu, dans l'ordre où un acheteur le lit : une
 * app retirée n'a plus ni prix ni statut, elle n'a donc que ce badge-là.
 */
function storeBadges(store: GameStoreListing | null): StoreBadge[] {
  if (!store) return [];
  if (!store.isAvailable) return [{ label: "Removed from Steam", color: "var(--status-critical)" }];

  const badges: StoreBadge[] = [];
  if (store.isFree) badges.push({ label: "Free", color: "var(--status-good)" });
  else if (store.priceUsd !== null) badges.push({ label: usd.format(store.priceUsd), color: "var(--color-brand-blue)" });
  // Un DLC sans offre d'achat ne s'obtient qu'avec une édition du jeu (Blood
  // and Wine, les DLC offerts de The Witcher 3). Annoncé, il n'a juste pas
  // encore de prix.
  else if (store.appType === "dlc" && !store.isComingSoon) badges.push({ label: "Not sold separately" });

  const type = APP_TYPE_LABELS[store.appType];
  if (type) badges.push({ label: type, ...STEAM_TYPE_BADGES[store.appType] });
  if (store.isComingSoon) badges.push({ label: "Coming soon", color: "var(--color-brand-blue)" });
  if (store.isEarlyAccess) badges.push({ label: "Early Access", ...STEAM_EARLY_ACCESS_BADGE });
  return badges;
}

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
  const badges = storeBadges(stats.store);

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
            {badges.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2" aria-label="Steam store listing">
                {badges.map((badge) => (
                  <span
                    key={badge.label}
                    className="rounded-[4px] border border-current bg-[#0c1116]/60 px-2.5 py-1 font-mono text-[11px] font-bold tracking-[0.1em] uppercase"
                    style={{
                      color: badge.color ?? "#cfdae1",
                      ...(badge.fill && { background: badge.fill.background, borderColor: badge.fill.border }),
                    }}
                  >
                    {badge.label}
                  </span>
                ))}
              </div>
            )}
            {stats.store?.parentGame && (
              <p className="mt-2.5 text-sm text-[#9fb2bd]">
                DLC for{" "}
                <Link href={`/games/${stats.store.parentGame.appId}`} className="font-bold text-[#eef2f4] hover:text-brand-blue">
                  {stats.store.parentGame.name} →
                </Link>
              </p>
            )}
            {tags.length > 0 && (
              <div className={`${badges.length > 0 ? "mt-2" : "mt-4"} flex flex-wrap gap-2`}>
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

      {/* Bandeau de KPI, à fond perdu comme le pouls de la home : les
          quatre chiffres de droite viennent de `game_stats`, seules les barres de
          gauche demandent une requête — d'où leur boundary. */}
      <div className="grid grid-cols-2 border-y border-[#1a2530] lg:grid-cols-5">
        <div className="col-span-2 border-[#16202a] px-5 py-4 lg:col-span-1 lg:border-r">
          <div className="flex items-center gap-2 font-mono text-[9px] tracking-[0.12em] text-[#7d919c] uppercase">
            reviews / day · 31d
            <InfoHint text="Reviews posted each day over the 31 days leading up to the latest review loaded for this game; not necessarily the last 31 days on the calendar." />
          </div>
          <div className="mt-2">
            <Suspense fallback={<VolumeSkeleton />}>
              <VolumeSection appId={numericAppId} />
            </Suspense>
          </div>
        </div>
        {/* Steam compte le temps de jeu sur le jeu de base : la médiane d'un DLC vaut toujours 0. */}
        <StatTile
          label="median playtime"
          {...(stats.store?.appType === "dlc"
            ? { value: "—", note: "Steam doesn't track DLC playtime" }
            : { value: `${Math.round(stats.playtimeMedianMinutes / 60)}h`, note: "all time, per reviewer" })}
          hint="Median total playtime of the reviewers, counted up to today rather than at the moment they wrote their review."
          className="border-r border-[#16202a]"
        />
        <StatTile
          label="steam deck"
          value={`${Math.round(stats.pctSteamDeck * 100)}%`}
          note="played mostly on Deck"
          hint="Share of reviewers Steam flags as having played this game mostly on a Steam Deck."
          className="lg:border-r lg:border-[#16202a]"
        />
        <StatTile
          label="refunded"
          value={`${(stats.pctRefunded * 100).toFixed(1)}%`}
          note="of reviewers"
          hint="Share of reviewers who later refunded the game. Steam keeps their review, marked as refunded."
          className="border-r border-[#16202a]"
        />
        {/* Méthode Boxleiter, cf. `src/lib/revenue.ts` : avant la commission de Steam. */}
        <StatTile
          label="est. gross revenue"
          {...revenueTile(stats)}
          hint="A rough guess: each review stands for about 30 to 70 copies sold, times the price. Could be off by half."
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

      <Suspense fallback={null}>
        <DlcSection appId={numericAppId} />
      </Suspense>

      <DigDeeper title="Keep digging" note="three ways out of this page" doors={doorsFor(stats)} />
    </div>
  );
}
