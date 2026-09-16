import { Nav } from "@/components/Nav";
import { SectionHead } from "@/components/HomeEditorial";
import { Skeleton } from "@/components/Skeleton";
import {
  CoverageBandSkeleton,
  LanguagesSkeleton,
  ReviewsSkeleton,
  TrendsHeading,
  TrendsSkeleton,
  VolumeSkeleton,
} from "./sections";

// Affiché pendant que `getGameStats` résout. Ensuite la page elle-même stream et
// ses sections gardent leurs propres boundaries — d'où les mêmes placeholders
// ici : le lecteur voit un remplissage continu, pas un repaint. Le wrapper
// reprend celui de `page.tsx` : `mx-auto` sur la racine en ferait un flex item
// du `body` sans `align-self: stretch`, donc en `fit-content`.
export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
      <Nav variant="banded" active="games" />
      <CoverageBandSkeleton />

      <div className="relative flex items-center overflow-hidden bg-[linear-gradient(115deg,#2a1206_0%,#0c1116_62%)] lg:min-h-[440px]">
        <div className="relative grid w-full grid-cols-[100px_minmax(0,1fr)] items-end gap-5 px-6 py-10 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-7 sm:px-8 lg:max-w-[62%] lg:py-12">
          <Skeleton className="aspect-[2/3] w-full rounded-[4px]" />
          <div>
            <Skeleton className="h-3 w-56" />
            <Skeleton className="mt-3.5 h-12 w-full max-w-[420px]" />
            <div className="mt-4 flex items-end gap-[18px]">
              <Skeleton className="h-11 w-24" />
              <Skeleton className="h-8 w-56" />
            </div>
            <div className="mt-4 flex gap-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-28 rounded-full" />
            </div>
            <div className="mt-5 flex gap-2.5">
              <Skeleton className="h-10 w-40 rounded-full" />
              <Skeleton className="h-10 w-36 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 border-y border-[#1a2530] lg:grid-cols-4">
        <div className="border-r border-[#16202a] px-5 py-4">
          <div className="font-mono text-[9px] tracking-[0.12em] text-[#7d919c] uppercase">reviews / day · 31d</div>
          <div className="mt-2">
            <VolumeSkeleton />
          </div>
        </div>
        {["median playtime", "steam deck", "refunded"].map((label, i) => (
          <div
            key={label}
            className={`flex flex-col justify-between gap-5 px-5 py-4 ${i < 2 ? "border-r border-[#16202a]" : ""}`}
          >
            <div className="font-mono text-[9px] tracking-[0.12em] text-[#7d919c] uppercase">{label}</div>
            <Skeleton className="h-[26px] w-20" />
          </div>
        ))}
      </div>

      <div className="border-b border-[#1a2530] px-6 py-4 sm:px-8">
        <div className="font-mono text-[9px] tracking-[0.12em] text-[#7d919c] uppercase">reviews by language</div>
        <LanguagesSkeleton />
      </div>

      <div className="px-6 py-8 sm:px-8">
        <div className="mx-auto max-w-[1320px]">
          <TrendsHeading />
          <TrendsSkeleton />
        </div>
      </div>

      <div className="border-t border-[#1a2530] px-6 py-8 sm:px-8">
        <div className="mx-auto max-w-[1320px]">
          <SectionHead title="Both camps" note="the most upvoted review on each side" />
          <ReviewsSkeleton />
        </div>
      </div>
    </div>
  );
}
