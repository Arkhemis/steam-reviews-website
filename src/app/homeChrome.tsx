import Link from "next/link";
import { Nav } from "@/components/Nav";
import { SectionHeading } from "@/components/SectionHeading";
import { Skeleton } from "@/components/Skeleton";

// La partie statique de la home — titres de section, filtres, gabarits d'attente
// — partagée entre `page.tsx` et son `loading.tsx`. Les deux doivent réserver
// exactement les mêmes boîtes : le loading state s'affiche avant que le flux RSC
// n'arrive, et si les deux divergent le lecteur voit la page sauter.

export const CHART_FILTERS = [
  { label: "Trending", href: "/classements" },
  { label: "Best rated", href: "/classements?filter=mieux-notes" },
  { label: "Most reviewed", href: "/classements?filter=plus-commentes" },
  { label: "Worst rated", href: "/classements?filter=pires-notes" },
] as const;

export const CHART_SIZE = 5;
export const GRID_SIZE = 20;

export function ChartsHeading() {
  return (
    <SectionHeading
      number="01"
      title="Charts"
      note="rising over 30 days · 1,000-review floor"
      action={
        <div className="flex flex-wrap gap-1.5">
          {CHART_FILTERS.map((f) => (
            <Link
              key={f.label}
              href={f.href}
              className="rounded-full border border-[#24333f] px-3 py-1 text-xs font-semibold text-[#9fb2bd]"
            >
              {f.label}
            </Link>
          ))}
        </div>
      }
    />
  );
}

export function GamesHeading({ note }: { note: React.ReactNode }) {
  return (
    <SectionHeading
      number="02"
      title="Games"
      note={note}
      action={
        <Link href="/games" className="font-mono text-[10px] tracking-[0.12em] text-brand-blue uppercase">
          browse all →
        </Link>
      }
    />
  );
}

export function GamesCountFallback() {
  return <Skeleton className="inline-block h-3 w-64 align-middle" />;
}

export function HeroCopyFallback() {
  return (
    <div className="mt-4 grid grid-cols-1 items-end gap-8 lg:grid-cols-[minmax(0,620px)_minmax(0,1fr)] lg:gap-10">
      <div>
        <Skeleton className="h-[54px] w-full max-w-[560px] sm:h-[60px] lg:h-[106px]" />
        <Skeleton className="mt-4 h-12 w-full max-w-[50ch]" />
        <Skeleton className="mt-5 h-10 w-full max-w-[420px]" />
      </div>
      <div className="flex justify-start gap-8 pb-1.5 lg:justify-end">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <Skeleton className="h-8 w-16" />
            <Skeleton className="mt-1 h-2.5 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

// L'étagère se dessine par-dessus un dégradé plein cadre : un placeholder gris
// serait plus voyant que le trou. On réserve juste sa hauteur.
export function ShelfFallback() {
  return <div className="mt-4 h-[300px] sm:h-[380px] lg:h-[430px]" />;
}

export function ChartsFallback() {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px] space-y-2">
        {Array.from({ length: CHART_SIZE }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}

export function GamesGridFallback() {
  return (
    <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
      {Array.from({ length: GRID_SIZE }, (_, i) => (
        <Skeleton key={i} className="aspect-[2/3] w-full rounded-[3px]" />
      ))}
    </div>
  );
}

// Le squelette complet de la home, monté par `loading.tsx`. Il reprend le même
// wrapper que `page.tsx` : `min-h-screen bg-[#0c1116]` sur la racine, `mx-auto`
// seulement sur le conteneur interne. La racine est un enfant direct du `body`
// en `flex flex-col`, et un flex item avec `margin-inline: auto` perd son
// `align-self: stretch` — il se ratatinerait en `fit-content`.
export function HomeSkeleton() {
  return (
    <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-7">
        <Nav />
        <HeroCopyFallback />
        <ShelfFallback />
      </div>

      <div className="border-t border-[#1a2530] px-5 py-9 sm:px-7">
        <div className="mx-auto max-w-[1320px]">
          <ChartsHeading />
          <ChartsFallback />
        </div>
      </div>

      <div className="border-t border-[#1a2530] px-5 py-9 sm:px-7">
        <div className="mx-auto max-w-[1320px]">
          <GamesHeading note={<GamesCountFallback />} />
          <GamesGridFallback />
        </div>
      </div>
    </div>
  );
}
