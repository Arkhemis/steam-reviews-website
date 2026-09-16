import Image from "next/image";
import { InfoHint } from "@/components/InfoHint";
import { LanguageDistribution } from "@/components/LanguageDistribution";
import { ReviewBattle } from "@/components/ReviewBattle";
import { ScoreEvolutionChart } from "@/components/ScoreEvolutionChart";
import { Skeleton, SkeletonLines } from "@/components/Skeleton";
import { paddedDailyVolume } from "@/lib/cataloguePulse";
import { resolveSteamHeroArt } from "@/lib/steamArtwork";
import {
  getGameCoverage,
  getGameDailyTrend,
  getGameEvents,
  getGameLanguageDistribution,
  getGameReviewLanguages,
  getGameReviewTrends,
  getGameTopReviews,
} from "@/lib/data/gameData";
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
          share of positive reviews written that month — not the cumulative score
          <InfoHint text="Each point covers only the reviews written during that month, so a bad patch shows up here long before it moves the score at the top of the page." />
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
