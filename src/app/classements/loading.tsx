import { ChartRowHeader } from "@/components/ChartRow";
import { Nav } from "@/components/Nav";
import { Skeleton } from "@/components/Skeleton";

// Le classement lit `searchParams`, donc rien n'est prérendu. Les libellés de
// colonnes ne dépendent d'aucune requête : on les rend pour de vrai, seules les
// lignes sont des placeholders. `ROWS` suit la taille de page de `page.tsx`.
const ROWS = 20;

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-7">
        <Nav />

        <Skeleton className="mt-8 h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-full max-w-xl" />

        <div className="mt-5 flex flex-wrap gap-1.5">
          {["7rem", "6rem", "8rem", "6.5rem"].map((width) => (
            <Skeleton key={width} className="h-6 rounded-full" style={{ width }} />
          ))}
        </div>

        <div className="mt-6 overflow-x-auto">
          <div className="min-w-[560px]">
            <ChartRowHeader reviewsLabel="avis" positiveLabel="positif" shiftLabel="évolution" />
            {Array.from({ length: ROWS }, (_, i) => (
              <div key={i} className="border-t border-[#16202a] py-3.5">
                <Skeleton className="h-[34px] w-full rounded-[3px]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
