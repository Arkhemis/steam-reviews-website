import { Nav } from "@/components/Nav";
import { Skeleton } from "@/components/Skeleton";

// Le temps que Steam rende la bibliothèque : l'en-tête du joueur, le bandeau de
// chiffres et la grille des plus joués, aux mêmes dimensions que la page.
const MOST_PLAYED_ROWS = 12;

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-7">
        <Nav active="library" />
        <div className="mt-8 flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-md" />
          <div>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="mt-2 h-4 w-24" />
          </div>
        </div>
        <Skeleton className="mt-6 h-[196px] w-full rounded-md lg:h-[98px]" />
        <Skeleton className="mt-10 h-8 w-72" />
        <Skeleton className="mt-[18px] h-3 w-full rounded-[4px]" />
        <Skeleton className="mt-10 h-8 w-44" />
        <div className="mt-[18px] grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: MOST_PLAYED_ROWS }, (_, i) => (
            <Skeleton key={i} className="h-[88px] w-full rounded-[5px]" />
          ))}
        </div>
      </div>
    </div>
  );
}
