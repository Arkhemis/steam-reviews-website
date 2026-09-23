import { Nav } from "@/components/Nav";
import { Skeleton } from "@/components/Skeleton";

// Le duel attend les deux fiches et leurs reviews : on réserve le bandeau de
// titre et l'écran de choix du camp.
export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
      <Nav variant="banded" />
      <div className="border-b border-[#1a2530] bg-[linear-gradient(115deg,#0d2018_0%,#0c1116_50%,#2a1206_100%)] px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-[1320px]">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="mt-3 h-12 w-[min(640px,100%)]" />
          <Skeleton className="mt-3 h-4 w-[min(520px,100%)]" />
        </div>
      </div>
      <div className="px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-[1320px]">
          <Skeleton className="h-[520px] w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}
