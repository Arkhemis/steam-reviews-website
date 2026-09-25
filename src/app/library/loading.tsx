import { Nav } from "@/components/Nav";
import { Skeleton } from "@/components/Skeleton";

// Sans ce fichier la route hériterait du `loading.tsx` racine, qui dessine la
// home. La page ne fait attendre que la résolution d'une URL personnalisée.
export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-7">
        <Nav active="library" />
        <div className="mx-auto mt-16 max-w-xl">
          <Skeleton className="h-9 w-80 max-w-full" />
          <Skeleton className="mt-3 h-12 w-full" />
          <Skeleton className="mt-8 h-10 w-52 rounded-md" />
          <Skeleton className="mt-16 h-11 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}
