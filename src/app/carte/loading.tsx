import { Nav } from "@/components/Nav";
import { Skeleton } from "@/components/Skeleton";

// La carte est force-dynamic et inline ~170 tracés de pays : son HTML est le
// plus lent du site à arriver. Même wrapper que `page.tsx` — `min-h-screen
// bg-[#0c1116]` sur la racine, `mx-auto` seulement à l'intérieur, sinon le
// `body` en `flex flex-col` ne l'étire plus — et même viewBox 1000x480 que la
// vraie SVG, pour que la légende ne saute pas quand la carte atterrit.
export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-7">
        <Nav />

        <Skeleton className="mt-6 h-8 w-full max-w-[26rem]" />
        <Skeleton className="mt-3 h-10 w-full max-w-md rounded-full" />
        <Skeleton className="mt-4 h-16 w-full max-w-2xl rounded-r-md" />

        <div className="mt-6 rounded-xl bg-gradient-to-b from-white/5 to-transparent p-4">
          <Skeleton className="aspect-[1000/480] w-full" />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-2.5 flex-1 rounded-full" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="mt-2 h-2.5 w-full max-w-xl" />

        <Skeleton className="mt-8 mb-3 h-3 w-72" />
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-11 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
