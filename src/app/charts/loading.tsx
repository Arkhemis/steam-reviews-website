import { Nav } from "@/components/Nav";
import { Skeleton } from "@/components/Skeleton";
import { CHART_FILTERS } from "@/lib/charts";

// La page lit `searchParams` et Postgres à chaud, donc rien n'est prérendu.
// Le squelette doit réserver les mêmes boîtes que `page.tsx` — nav à fond
// perdu, bande d'échelle, héros, rubriques et grille — sinon la page saute
// quand le flux RSC arrive.
//
// `ROWS` et `SHELF` suivent `PAGE_SIZE` et `SHELF_SIZE` de `page.tsx`.
const ROWS = 24;
const SHELF = 8;
const SHELVES = ["Hidden gems", "Freshly released", "Nobody agrees"];

const GRID = "grid grid-cols-3 gap-3.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8";

function CoverGrid({ count }: { count: number }) {
  return (
    <div className={GRID}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <Skeleton className="aspect-[2/3] w-full rounded-[3px]" />
          <Skeleton className="mt-[7px] h-3 w-full" />
          <Skeleton className="mt-1 h-3 w-10" />
        </div>
      ))}
    </div>
  );
}

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
      <Nav variant="banded" active="charts" />

      <div className="border-b border-[#16202a] bg-[#0a0f14] px-6 py-2.5 sm:px-8">
        <Skeleton className="h-[17px] w-72 max-w-full" />
      </div>

      <div className="flex items-center bg-[linear-gradient(115deg,#2a1206_0%,#0c1116_62%)] lg:min-h-[300px]">
        <div className="w-full px-6 py-[30px] sm:px-8 lg:max-w-[62%]">
          <Skeleton className="h-3 w-72 max-w-full" />
          <Skeleton className="mt-3 h-[44px] w-full max-w-[440px] lg:h-[46px]" />
          <div className="mt-3.5 flex items-baseline gap-[18px]">
            <Skeleton className="h-[38px] w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="mt-3.5 h-12 w-full max-w-[48ch]" />
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Skeleton className="h-[42px] w-40 rounded-full" />
            <Skeleton className="h-[42px] w-48 rounded-full" />
          </div>
        </div>
      </div>

      <div className="border-t border-[#1a2530] px-6 pt-7 pb-2 sm:px-8">
        <div className="mx-auto max-w-[1320px]">
          {SHELVES.map((title) => (
            <div key={title} className="mb-7">
              <div className="mb-[18px] flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="m-0 text-[26px] font-extrabold tracking-tight">{title}</h2>
                <Skeleton className="h-2.5 w-16" />
              </div>
              <CoverGrid count={SHELF} />
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-[#1a2530] px-6 pt-7 pb-10 sm:px-8">
        <div className="mx-auto max-w-[1320px]">
          {/* Les intitulés qui ne dépendent d'aucune requête sont rendus pour
              de vrai : une boîte grise à leur place serait plus voyante que le
              trou qu'elle bouche. */}
          <div className="mb-[18px] flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="m-0 text-[26px] font-extrabold tracking-tight">All games</h2>
            <Skeleton className="h-[38px] w-full max-w-[320px] rounded-full" />
          </div>

          <div className="flex flex-wrap gap-2 border-b border-[#16202a] pb-4">
            {CHART_FILTERS.map((f) => (
              <span
                key={f.key}
                className="rounded-full border border-[#24333f] px-3.5 py-1.5 text-xs font-semibold text-[#3a4750]"
              >
                {f.label}
              </span>
            ))}
          </div>

          <div className="pt-5">
            <CoverGrid count={ROWS} />
          </div>
        </div>
      </div>
    </div>
  );
}
