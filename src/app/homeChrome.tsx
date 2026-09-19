import { SectionHead } from "@/components/HomeEditorial";
import { Nav } from "@/components/Nav";
import { Skeleton, SkeletonLines } from "@/components/Skeleton";

// Le squelette de la home, monté par `loading.tsx`. La home est
// `force-dynamic` : sans lui, le navigateur reste sur un document vide le
// temps que Postgres réponde. Il doit réserver les mêmes boîtes que
// `HomeEditorial`, sinon la page saute quand le flux RSC arrive — nav à fond
// perdu comprise, puis carrousel et sa rangée de puces, bandeau de pouls,
// podium et portes de sortie.

const PODIUM_SIZE = 5;

// La bande d'échelle ne tient qu'un compteur : on réserve sa hauteur, sans
// quoi le héros remonterait d'une ligne à l'arrivée du flux.
function ScaleBandFallback() {
  return (
    <div className="border-b border-[#16202a] bg-[#0a0f14] px-6 py-2.5 sm:px-8">
      <Skeleton className="h-[17px] w-72 max-w-full" />
    </div>
  );
}

// Le bandeau d'une récompense, puis la rangée de puces qui le suit : les
// intitulés des récompenses dépendent des données (l'année, le repli à trente
// jours), on ne réserve donc que leur place.
const CHIP_WIDTHS = ["w-32", "w-24", "w-24", "w-28", "w-32", "w-36"];

function AwardsFallback() {
  return (
    <div className="bg-[linear-gradient(115deg,#2a1206_0%,#0c1116_62%)]">
      <div className="mx-auto flex max-w-[1320px] items-center px-6 pt-12 pb-8 sm:px-8 lg:min-h-[460px] lg:pt-16">
        <div className="w-full lg:max-w-[52%]">
          <Skeleton className="h-3 w-56" />
          <Skeleton className="mt-3 h-[44px] w-full max-w-[520px] sm:h-12 lg:h-[58px]" />
          <div className="mt-4 flex items-baseline gap-[18px]">
            <Skeleton className="h-[44px] w-32" />
            <Skeleton className="h-3 w-40" />
          </div>
          <div className="mt-[18px] max-w-[46ch] border-l-[3px] border-[#1e2b36] pl-4">
            <SkeletonLines widths={["100%", "96%", "88%"]} />
          </div>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Skeleton className="h-[42px] w-40 rounded-full" />
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-[1320px] gap-2 overflow-hidden px-6 pb-6 sm:px-8">
        {CHIP_WIDTHS.map((width, i) => (
          <Skeleton key={i} className={`h-[29px] shrink-0 rounded-full ${width}`} />
        ))}
      </div>
    </div>
  );
}

// Les deux graphes n'ont pas de placeholder : une boîte grise de la taille
// d'une courbe est plus voyante que le trou qu'elle bouche. On garde les
// intitulés, qui ne dépendent d'aucune requête, et la hauteur des cellules.
function PulseBandFallback() {
  const cells = ["catalogue sentiment · 12 mo", "reviews / day · 31d", "this week", "catalogue"];

  return (
    <div className="grid grid-cols-2 border-y border-[#1a2530] lg:grid-cols-4">
      {cells.map((label, i) => (
        <div key={label} className={`px-5 py-4 ${i < cells.length - 1 ? "border-r border-[#16202a]" : ""}`}>
          <div className="font-mono text-[9px] tracking-[0.12em] text-[#7d919c] uppercase">{label}</div>
          <div className="mt-2 h-[54px]" />
        </div>
      ))}
    </div>
  );
}

function RunnersUpFallback() {
  return (
    <div className="px-6 py-8 sm:px-8">
      <div className="mx-auto max-w-[1320px]">
        <SectionHead title="Runners-up" note="the rest of the podium" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: PODIUM_SIZE - 1 }, (_, i) => (
            <div key={i} className="grid grid-cols-[70px_minmax(0,1fr)] items-center gap-3.5 rounded-[5px] border border-[#1e2b36] p-3.5">
              <Skeleton className="aspect-[2/3] w-[70px] rounded-[3px]" />
              <div>
                <Skeleton className="h-2.5 w-6" />
                <Skeleton className="mt-1.5 h-4 w-full max-w-[140px]" />
                <Skeleton className="mt-1.5 h-5 w-14" />
                <Skeleton className="mt-1.5 h-2.5 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DigDeeperFallback() {
  return (
    <div className="border-t border-[#1a2530] bg-[#0e141a] px-6 py-8 sm:px-8">
      <div className="mx-auto max-w-[1320px]">
        <SectionHead title="Dig deeper" note="three ways into the same catalogue" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-md border border-[#1e2b36] bg-[#0c1116] p-[22px]">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="mt-2.5 h-6 w-40" />
              <div className="mt-2.5">
                <SkeletonLines widths={["100%", "90%"]} />
              </div>
              <Skeleton className="mt-4 h-7 w-28" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
      <Nav variant="banded" />
      <ScaleBandFallback />
      <AwardsFallback />
      <PulseBandFallback />
      <RunnersUpFallback />
      <DigDeeperFallback />
    </div>
  );
}
