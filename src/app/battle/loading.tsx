import { Nav } from "@/components/Nav";
import { Skeleton } from "@/components/Skeleton";

// Le battle attend deux `getGameStats` avant de rendre quoi que ce soit. On
// réserve les deux jaquettes et les six barres comparatives de `page.tsx` pour
// que l'arrivée des données ne pousse pas la page vers le bas.
const STATS = 6;

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-7">
        <Nav />

        <p className="mt-6 text-center text-sm text-[#9fb2bd]">
          Face-à-face 100% calculé à partir des données existantes — pas de vote, pas de compte.
        </p>

        <div className="mt-6 flex items-center justify-center gap-8">
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <Skeleton className="h-24 w-24 rounded-2xl" />
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>

        <div className="mx-auto mt-6 max-w-2xl space-y-4">
          {Array.from({ length: STATS }, (_, i) => (
            <div key={i}>
              <Skeleton className="mx-auto mb-1 h-3 w-40" />
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-2.5 flex-1" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          ))}
        </div>

        <Skeleton className="mx-auto mt-8 mb-3 h-3 w-56" />
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
