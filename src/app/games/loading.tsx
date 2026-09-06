import { Nav } from "@/components/Nav";
import { Skeleton } from "@/components/Skeleton";

// Sans ce fichier la route hériterait du `loading.tsx` racine, qui dessine la
// home : le lecteur verrait une étagère et des charts avant d'obtenir une
// grille de jaquettes. Même gabarit que `page.tsx`, une tuile par jeu de la page.
const PAGE_SIZE = 24;

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-7">
        <Nav />

        <Skeleton className="mt-8 h-8 w-28" />
        <Skeleton className="mt-2 h-4 w-72" />
        <Skeleton className="mt-6 h-10 w-full max-w-md" />

        <div className="mt-6 grid grid-cols-3 gap-2.5 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
          {Array.from({ length: PAGE_SIZE }, (_, i) => (
            <Skeleton key={i} className="aspect-[2/3] w-full rounded-[3px]" />
          ))}
        </div>
      </div>
    </div>
  );
}
