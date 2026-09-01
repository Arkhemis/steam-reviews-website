import { Nav } from "@/components/Nav";
import { Skeleton } from "@/components/Skeleton";
import { LanguagesSkeleton, ReviewsSkeleton, TrendsSkeleton } from "./sections";

// Shown while `getGameStats` resolves. Once it does, the page itself streams in
// and the three sections keep their own boundaries — so these placeholders are
// deliberately the same ones, and the reader sees one continuous fill-in rather
// than a full repaint.
export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
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
    </main>
  );
}
