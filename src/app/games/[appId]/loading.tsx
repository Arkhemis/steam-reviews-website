import { Nav } from "@/components/Nav";
import { Skeleton } from "@/components/Skeleton";
import { LanguagesSkeleton, ReviewsSkeleton, TrendsSkeleton } from "./sections";

// Affiché pendant que `getGameStats` résout. Ensuite la page elle-même stream et
// ses trois sections gardent leurs propres boundaries — d'où les mêmes
// placeholders ici : le lecteur voit un remplissage continu, pas un repaint.
// Le wrapper reprend celui de `page.tsx` : `mx-auto` sur la racine en ferait un
// flex item du `body` sans `align-self: stretch`, donc en `fit-content`.
export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-7">
        <Nav />

        <div className="mt-6 flex items-center gap-5">
          <Skeleton className="h-32 w-32 flex-shrink-0 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-72" />
            <Skeleton className="h-3 w-96" />
            <Skeleton className="mt-2 h-6 w-56 rounded-full" />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[68px] rounded-lg" />
          ))}
        </div>

        <div className="mt-8 grid grid-cols-[1.4fr_1fr] gap-5">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h2 className="mb-2 text-xs uppercase tracking-wide text-neutral-400">Évolution du score positif</h2>
            <TrendsSkeleton />
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h2 className="mb-2 text-xs uppercase tracking-wide text-neutral-400">Langues</h2>
            <LanguagesSkeleton />
          </div>
        </div>

        <h2 className="mt-8 mb-3 text-xs uppercase tracking-wide text-neutral-400">Reviews les plus votées</h2>
        <ReviewsSkeleton />

        <Skeleton className="mt-8 h-[86px] w-full rounded-xl" />
      </div>
    </div>
  );
}
