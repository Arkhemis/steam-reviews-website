import Image from "next/image";
import Link from "next/link";
import { verdictColor } from "@/components/GameCoverTile";
import { SectionHead } from "@/components/HomeEditorial";
import { InfoHint } from "@/components/InfoHint";
import { LanguageDistribution } from "@/components/LanguageDistribution";
import { PointList } from "@/components/PointList";
import { ReviewBattle } from "@/components/ReviewBattle";
import { ScoreEvolutionChart } from "@/components/ScoreEvolutionChart";
import { Skeleton, SkeletonLines } from "@/components/Skeleton";
import { paddedDailyVolume } from "@/lib/cataloguePulse";
import { resolveSteamHeroArt } from "@/lib/steamArtwork";
import {
  getGameCoverage,
  getGameDailyTrend,
  getGameDlcs,
  getGameEvents,
  getGameLanguageDistribution,
  getGameReviewLanguages,
  getGameReviewSummary,
  getGameReviewTrends,
  getGameTopReviews,
} from "@/lib/data/gameData";
import type { GameDlc } from "@/lib/data/types";
import { resolveReviewLanguage } from "@/lib/reviewLanguage";

// Each section owns one query and one Suspense boundary, so the page shell (and
// the sections that answer first) reach the browser without waiting on the
// slowest of them. Seul `getGameStats` est attendu par la page : il décide
// entre la fiche et le 404, tout le reste arrive au fil du stream.
//
// These were also tried behind `next/dynamic` to split the chart and the review
// battle out of the route's initial JS. Measured on a production build, it
// produced the exact same 15 chunks and 17 KB *more* JS: Turbopack already
// merges this route's client components into one group and the lazy boundary
// doesn't override that. Static imports it is.

const enFull = new Intl.NumberFormat("en-US");
const enCompact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const VOLUME_DAYS = 31;

// Le masque ne découvre l'illustration que vers la droite : la colonne de
// texte garde un aplat opaque, sans cadre ni couture. Il porte sur un
// conteneur plutôt que sur l'image, dont `next/image` gère lui-même les styles.
const HERO_MASK =
  "linear-gradient(90deg,transparent 0%,rgba(0,0,0,0.12) 24%,rgba(0,0,0,0.5) 50%,rgba(0,0,0,0.85) 78%,#000 100%)";

function formatDay(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// --- Bandeau d'assiette ----------------------------------------------------
//
// Ce que le site a chargé de ce jeu, avant le moindre chiffre de la fiche :
// combien d'avis, dans combien de langues, et jusqu'à quand. Le compteur dit
// « analyzed » parce qu'il compte les avis réellement en base, et non le total
// que Steam déclare — celui du héros, juste en dessous.

function CoverageBandFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[41px] flex-wrap items-baseline gap-x-2.5 gap-y-1 border-b border-[#16202a] bg-[#0a0f14] px-6 py-2.5 sm:px-8">
      {children}
    </div>
  );
}

export function CoverageBandSkeleton() {
  return (
    <CoverageBandFrame>
      <Skeleton className="h-[17px] w-20" />
      <Skeleton className="h-2.5 w-64" />
    </CoverageBandFrame>
  );
}

export async function CoverageBand({ appId }: { appId: number }) {
  const coverage = await getGameCoverage(appId);

  return (
    <CoverageBandFrame>
      <span className="font-mono text-[17px] leading-none text-[#eef2f4]">
        {enFull.format(coverage.loadedReviews)}
      </span>
      <span className="font-mono text-[10px] tracking-[0.12em] text-[#7d919c] uppercase">
        reviews analyzed · {coverage.languageCount} languages
        {coverage.latestReviewOn ? ` · latest one ${formatDay(coverage.latestReviewOn)}` : ""}
      </span>
    </CoverageBandFrame>
  );
}

// --- Héros -----------------------------------------------------------------

// L'illustration panoramique de Steam n'existe pas pour tous les jeux, et la
// tâter coûte un aller-retour vers leur CDN : elle a sa propre boundary pour
// que le héros s'affiche sans l'attendre, et disparaît sans bruit quand Steam
// n'en a pas.
export async function HeroArt({ appId }: { appId: number }) {
  const art = await resolveSteamHeroArt(appId);
  if (!art) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 hidden w-[62%] lg:block">
      <div className="absolute inset-0" style={{ maskImage: HERO_MASK, WebkitMaskImage: HERO_MASK }}>
        <Image src={art} alt="" fill sizes="62vw" className="object-cover object-[70%_center]" />
      </div>
      {/* Le bas se referme sur le fond de page, sans couture avec le bandeau
          de KPI qui suit immédiatement. */}
      <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,17,22,0.25)_0%,rgba(12,17,22,0)_42%,#0c1116_100%)]" />
    </div>
  );
}

// --- Volume d'avis ---------------------------------------------------------

export function VolumeSkeleton() {
  return (
    <div className="flex h-[54px] items-end gap-[2px]">
      {Array.from({ length: VOLUME_DAYS }, (_, i) => (
        <Skeleton key={i} className="flex-1 rounded-[1px]" style={{ height: `${30 + ((i * 37) % 70)}%` }} />
      ))}
    </div>
  );
}

export async function VolumeSection({ appId }: { appId: number }) {
  const volume = paddedDailyVolume(await getGameDailyTrend(appId, VOLUME_DAYS), VOLUME_DAYS);

  if (volume.length === 0) {
    return <p className="font-mono text-[10px] text-[#5f7481]">No review in the last {VOLUME_DAYS} days.</p>;
  }

  const peak = Math.max(...volume, 1);

  return (
    <div
      className="flex h-[54px] items-end gap-[2px]"
      role="img"
      aria-label={`Reviews per day over the game's last ${VOLUME_DAYS} days of reviews, peaking at ${enFull.format(peak)}`}
    >
      {volume.map((value, i) => (
        <span
          key={i}
          className="flex-1 rounded-[1px]"
          style={{
            // Un jour à zéro garde un trait d'un pixel : sans lui, le creux
            // ressemble à une donnée manquante plutôt qu'à un jour sans avis.
            height: value === 0 ? "1px" : `${Math.max((value / peak) * 100, 4)}%`,
            backgroundColor: value / peak >= 0.92 ? "#e8622a" : "#24414f",
          }}
        />
      ))}
    </div>
  );
}

// --- Langues ---------------------------------------------------------------

export function LanguagesSkeleton() {
  return (
    <div>
      <Skeleton className="mt-2.5 h-2.5 w-full rounded-[2px]" />
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {["64px", "96px", "72px", "88px", "60px", "80px"].map((width) => (
          <Skeleton key={width} className="h-2.5" style={{ width }} />
        ))}
      </div>
    </div>
  );
}

export async function LanguagesSection({ appId }: { appId: number }) {
  const languages = await getGameLanguageDistribution(appId);
  return <LanguageDistribution languages={languages} />;
}

// --- Résumé des avis --------------------------------------------------------
//
// Seuls les jeux assez commentés des deux côtés ont un résumé : la section
// disparaît sinon, sans skeleton, pour la même raison que les DLC.

export async function SummarySection({ appId }: { appId: number }) {
  const summary = await getGameReviewSummary(appId);
  if (!summary) return null;

  const hint =
    `Written by ${summary.model}, an open language model run by steam.reviews, from ${enFull.format(summary.reviewsUsed)} reviews: ` +
    "the most helpful and a few of the funniest on each side, spread across languages by how much each one reviews the game. " +
    `Generated ${formatDay(summary.generatedOn)}. It can get things wrong.`;

  return (
    <div className="border-b border-[#1a2530] px-6 py-8 sm:px-8">
      <div className="mx-auto max-w-[1320px]">
        <SectionHead
          title="What players say"
          note={
            <span className="flex items-center gap-1.5">
              an AI summary of the reviews
              <InfoHint text={hint} />
            </span>
          }
        />
        <div className="rounded-md border border-[#1e2b36] bg-[#0a0f14] p-5">
          <p className="m-0 max-w-[80ch] text-[15px] leading-relaxed text-[#cfdae1]">{summary.summary}</p>
          <h3 className="mt-6 mb-3 text-lg font-extrabold tracking-tight">In a nutshell…</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PointList tone="good" title="Pros" points={summary.pros} />
            <PointList tone="critical" title="Cons" points={summary.cons} />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Courbe du score -------------------------------------------------------

// Le titre de la carte, rendu à l'identique par la page et par son loading
// state — d'où sa place ici, à côté des skeletons. Il porte l'explication de la
// courbe parce que rien dans le graphe ne la donne : un point de mars 2024 ne
// parle que des reviews écrites en mars 2024, alors que le `%` du héros juste
// au-dessus est le cumul depuis la sortie. Deux chiffres qui ne se ressemblent
// pas et que rien ne distinguait.
export function TrendsHeading() {
  return (
    <div className="mb-[18px] flex flex-wrap items-baseline justify-between gap-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="m-0 text-[26px] font-extrabold tracking-tight">What each month thought</h2>
        <span className="flex items-center gap-1.5 text-sm text-[#7d919c]">
          share of positive reviews written that month, against the cumulative score
          <InfoHint text="The blue line covers only the reviews written during that month, so a bad patch shows up there long before it moves the score at the top of the page. The green line is the cumulative score: every review written up to the end of that month." />
        </span>
      </div>
    </div>
  );
}

export function TrendsSkeleton() {
  return (
    <div className="rounded-md border border-[#1e2b36] bg-[#0a0f14] p-5">
      <Skeleton className="aspect-[640/220] w-full" />
      {/* La règle des mois fait partie du graphe : sans sa place réservée, la
          carte grandit d'une ligne quand la série arrive. */}
      <div className="mt-1.5 flex justify-between px-[3.75%]">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-2.5 w-12" />
        ))}
      </div>
    </div>
  );
}

export async function TrendsSection({ appId }: { appId: number }) {
  // Les deux requêtes sont indépendantes et touchent deux marts distincts : on
  // ne fait pas attendre la courbe pendant qu'on lit les annonces.
  const [trends, events] = await Promise.all([getGameReviewTrends(appId), getGameEvents(appId)]);

  return (
    <div className="rounded-md border border-[#1e2b36] bg-[#0a0f14] p-5">
      <ScoreEvolutionChart trends={trends} events={events} />
    </div>
  );
}

// --- Les deux camps --------------------------------------------------------

export function ReviewsSkeleton() {
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Skeleton className="h-[26px] w-44 rounded-full" />
        <Skeleton className="h-[26px] w-44 rounded-full" />
        <Skeleton className="h-[26px] w-24 rounded-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-md border border-[#1e2b36] bg-[#0a0f14] p-5">
            <div className="mb-4 flex items-center gap-2.5">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-3 w-28" />
            </div>
            <SkeletonLines widths={["100%", "96%", "100%", "72%"]} />
          </div>
        ))}
      </div>
    </div>
  );
}

export async function ReviewsSection({ appId, lang }: { appId: number; lang?: string }) {
  // Les deux requêtes s'enchaînent au lieu de partir en parallèle : la langue à
  // charger dépend de celles que le jeu possède (défaut anglais, repli sur la
  // mieux représentée). Le GROUP BY est indexé et ne lit aucun `review_text`,
  // donc l'aller-retour supplémentaire est négligeable devant la requête des
  // reviews elles-mêmes.
  const languages = await getGameReviewLanguages(appId);
  const language = resolveReviewLanguage(languages, lang);
  const reviews = await getGameTopReviews(appId, { language });

  return <ReviewBattle reviews={reviews} languages={languages} selectedLanguage={language} />;
}

// --- DLC ---------------------------------------------------------------------
//
// Le sens inverse du lien « DLC for » du héros : depuis un jeu, ses extensions.
// La section disparaît entièrement pour un jeu sans DLC — l'immense majorité —
// d'où l'absence de skeleton : réserver sa place ferait sauter la page à vide.

function DlcTile({ dlc }: { dlc: GameDlc }) {
  const color = dlc.pctPositive === null ? "#5f7481" : verdictColor(dlc.pctPositive * 100);
  const price = dlc.isFree ? "Free" : dlc.priceUsd === null ? null : usd.format(dlc.priceUsd);

  return (
    <Link href={`/games/${dlc.appId}`} className="group block text-[#eef2f4]">
      <span className="relative block aspect-[2/3] overflow-hidden rounded-[3px] bg-white/5">
        {dlc.coverUrl && <Image src={dlc.coverUrl} alt="" fill sizes="(min-width: 1024px) 110px, 30vw" className="object-cover" />}
        <span className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: color }} />
      </span>
      <span className="mt-[7px] line-clamp-2 text-xs leading-tight font-bold group-hover:text-brand-blue">{dlc.name}</span>
      <span className="mt-1 flex flex-wrap items-baseline gap-x-[7px] font-mono text-[11px]">
        {dlc.pctPositive === null ? (
          <span className="text-[#5f7481]">no reviews</span>
        ) : (
          <>
            <span style={{ color }}>{Math.round(dlc.pctPositive * 100)}%</span>
            <span className="text-[#7d919c]">{enCompact.format(dlc.totalReviews)}</span>
          </>
        )}
        {price && <span className="text-[#cfdae1]">{price}</span>}
      </span>
    </Link>
  );
}

export async function DlcSection({ appId }: { appId: number }) {
  const { dlcs, total } = await getGameDlcs(appId);
  if (dlcs.length === 0) return null;

  return (
    <div id="dlc" className="border-t border-[#1a2530] px-6 py-8 sm:px-8">
      <div className="mx-auto max-w-[1320px]">
        <SectionHead
          title="Downloadable content"
          note={total > dlcs.length ? `the ${dlcs.length} most reviewed of ${total}` : `${total} on Steam`}
          action={
            total > dlcs.length && (
              <a
                href={`https://store.steampowered.com/dlc/${appId}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[10px] tracking-[0.12em] text-brand-blue uppercase"
              >
                all {total} on Steam ↗
              </a>
            )
          }
        />
        <div className="grid grid-cols-3 gap-x-4 gap-y-5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12">
          {dlcs.map((dlc) => (
            <DlcTile key={dlc.appId} dlc={dlc} />
          ))}
        </div>
      </div>
    </div>
  );
}
