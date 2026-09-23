import { Nav } from "@/components/Nav";
import { Skeleton } from "@/components/Skeleton";

// Le battle attend les deux fiches avant de rendre l'arène. On réserve le HUD,
// les deux combattants, le bandeau du commentateur et les rounds de
// `BattleArena`, pour que l'arrivée des données ne pousse pas la page.
const ROUNDS = 6;

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
      <Nav variant="banded" />

      <section className="border-b border-[#1a2530] bg-[linear-gradient(115deg,#2a1206_0%,#0c1116_50%,#071526_100%)]">
        <div className="mx-auto max-w-[1320px] px-5 pt-6 pb-8 sm:px-8 sm:pt-7 sm:pb-10">
          <div className="flex items-end gap-3 sm:gap-6">
            <Skeleton className="h-[34px] flex-1" />
            <Skeleton className="h-[34px] w-12" />
            <Skeleton className="h-[34px] flex-1" />
          </div>
          <div className="mt-8 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:mt-10 sm:gap-8">
            {[0, 1].map((i) => (
              <div key={i} className={`flex flex-col gap-3 ${i === 1 ? "order-3 items-end" : "items-start"}`}>
                <Skeleton className="aspect-[2/3] w-[110px] rounded-[4px] sm:w-[170px]" />
                <Skeleton className="h-8 w-40 sm:w-56" />
                <Skeleton className="h-6 w-28" />
                <Skeleton className="h-[30px] w-full max-w-[240px] rounded-full" />
              </div>
            ))}
            <span className="order-2 text-5xl font-black text-white/10 italic sm:text-8xl">VS</span>
          </div>
          <div className="mt-8 flex min-h-[112px] flex-col items-center justify-center gap-2">
            <Skeleton className="h-2.5 w-40" />
            <Skeleton className="h-6 w-80 max-w-full" />
          </div>
        </div>
      </section>

      <div className="px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-[980px]">
          <Skeleton className="mb-[18px] h-8 w-56" />
          <div className="grid gap-2.5">
            {Array.from({ length: ROUNDS }, (_, i) => (
              <Skeleton key={i} className="h-[98px] w-full rounded-md" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
