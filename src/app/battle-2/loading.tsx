import { Nav } from "@/components/Nav";
import { Skeleton } from "@/components/Skeleton";

// Le champ attend les deux fiches : on réserve le bandeau de titre, les deux
// fiches d'armée et le champ lui-même, au ratio du canvas en paysage.
export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
      <Nav variant="banded" />
      <div className="border-b border-[#1a2530] bg-[linear-gradient(115deg,#2a1206_0%,#0c1116_50%,#071526_100%)] px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-[1320px]">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="mt-3 h-12 w-[min(640px,100%)]" />
          <Skeleton className="mt-3 h-4 w-[min(520px,100%)]" />
        </div>
      </div>
      <div className="px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-[1320px]">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Skeleton className="h-[260px] rounded-md" />
            <Skeleton className="h-[260px] rounded-md" />
          </div>
          <Skeleton className="mt-6 h-12 w-full" />
          <Skeleton className="mt-3 aspect-[960/440] w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}
