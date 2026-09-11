import { InfoHint } from "@/components/InfoHint";
import { LanguageDistribution } from "@/components/LanguageDistribution";
import { ReviewBattle } from "@/components/ReviewBattle";
import { ScoreEvolutionChart } from "@/components/ScoreEvolutionChart";
import { Skeleton, SkeletonLines } from "@/components/Skeleton";
import {
  getGameEvents,
  getGameLanguageDistribution,
  getGameReviewLanguages,
  getGameReviewTrends,
  getGameTopReviews,
} from "@/lib/data/gameData";
import { resolveReviewLanguage } from "@/lib/reviewLanguage";

// Each section owns one query and one Suspense boundary, so the page shell (and
// the sections that answer first) reach the browser without waiting on the
// slowest of the three.
//
// These were also tried behind `next/dynamic` to split the chart and the review
// battle out of the route's initial JS. Measured on a production build, it
// produced the exact same 15 chunks and 17 KB *more* JS: Turbopack already
// merges this route's client components into one group and the lazy boundary
// doesn't override that. Static imports it is.

// Le titre de la carte, rendu à l'identique par la page et par son loading
// state — d'où sa place ici, à côté des skeletons. Il porte l'explication de la
// courbe parce que rien dans le graphe ne la donne : un point de mars 2024 ne
// parle que des reviews écrites en mars 2024, alors que le `%` de la fiche juste
// au-dessus est le cumul depuis la sortie. Deux chiffres qui ne se ressemblent
// pas et que rien ne distinguait.
export function TrendsHeading() {
  return (
    <h2 className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wide text-neutral-400">
      Positive score over time
      <InfoHint text="Share of the reviews written that month that are positive." />
    </h2>
  );
}

// The chart's viewBox is 640x220, rendered full-width — same aspect here so the
// card doesn't resize when the series lands.
export function TrendsSkeleton() {
  return <Skeleton className="aspect-[640/220] w-full" />;
}

export function LanguagesSkeleton() {
  return (
    <div className="space-y-2">
      {["82%", "64%", "48%", "40%", "31%", "22%"].map((width) => (
        <div key={width} className="flex items-center gap-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-[10px] flex-1" style={{ maxWidth: width }} />
        </div>
      ))}
    </div>
  );
}

export function ReviewsSkeleton() {
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Skeleton className="h-6 w-44 rounded-full" />
        <Skeleton className="h-6 w-44 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="mb-2 flex items-center gap-2">
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

export async function TrendsSection({ appId }: { appId: number }) {
  // Les deux requêtes sont indépendantes et touchent deux marts distincts : on
  // ne fait pas attendre la courbe pendant qu'on lit les annonces.
  const [trends, events] = await Promise.all([getGameReviewTrends(appId), getGameEvents(appId)]);
  return <ScoreEvolutionChart trends={trends} events={events} />;
}

export async function LanguagesSection({ appId }: { appId: number }) {
  const languages = await getGameLanguageDistribution(appId);
  return <LanguageDistribution languages={languages} />;
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
