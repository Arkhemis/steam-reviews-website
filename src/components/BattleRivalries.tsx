import Link from "next/link";
import { SectionHead } from "@/components/HomeEditorial";
import { battleHref, RIVALRIES } from "@/lib/battle";

// Les grands classiques en pied des deux battles : même liste, seule la page
// d'arrivée change — les rounds de `/battle` ou les armées de `/battle-2`.
export function BattleRivalries({ leftAppId, rightAppId, path }: { leftAppId: number; rightAppId: number; path: string }) {
  const others = RIVALRIES.filter((r) => !(r.left.appId === leftAppId && r.right.appId === rightAppId));
  return (
    <div className="border-t border-[#1a2530] bg-[#0e141a] px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-[1320px]">
        <SectionHead title="Classic rivalries" note="one click, one fight" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {others.map((r) => (
            <Link
              key={`${r.left.appId}-${r.right.appId}`}
              href={battleHref(r.left.appId, r.right.appId, path)}
              className="group block rounded-md border border-[#1e2b36] bg-[#0c1116] p-[18px] transition-colors hover:border-brand-blue"
            >
              <span className="block font-mono text-[10px] tracking-[0.14em] text-brand-blue uppercase">{r.tagline}</span>
              <span className="mt-2 block text-[17px] leading-tight font-extrabold tracking-tight">
                {r.left.name}
                <span className="px-1.5 font-black text-[#5f7481] italic group-hover:text-brand-red">vs</span>
                {r.right.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
