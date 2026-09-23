import { Nav } from "@/components/Nav";
import { Skeleton } from "@/components/Skeleton";

// Le duel attend les deux fiches et leurs reviews : on réserve l'écran de
// choix du camp.
export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
      <Nav variant="banded" />
      <div className="px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-[1320px]">
          <Skeleton className="h-[520px] w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}
