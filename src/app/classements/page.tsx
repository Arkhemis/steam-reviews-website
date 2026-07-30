import Link from "next/link";
import { Nav } from "@/components/Nav";

type RankedGame = {
  appId: number;
  name: string;
  reviewCount: number;
  pctPositive: number;
  coverGradient: string;
};

const LEADERBOARD: RankedGame[] = [
  { appId: 1086940, name: "Baldur's Gate 3", reviewCount: 87412, pctPositive: 0.97, coverGradient: "from-[#ff5f6d] to-[#7f00ff]" },
  { appId: 553850, name: "Helldivers 2", reviewCount: 78123, pctPositive: 0.88, coverGradient: "from-[#36d1dc] to-[#5b86e5]" },
  { appId: 620, name: "Portal 2", reviewCount: 65210, pctPositive: 0.98, coverGradient: "from-[#7dffb0] to-[#199e70]" },
  { appId: 1245620, name: "Elden Ring", reviewCount: 58990, pctPositive: 0.93, coverGradient: "from-[#c98500] to-[#ffb347]" },
  { appId: 1091500, name: "Cyberpunk 2077", reviewCount: 52340, pctPositive: 0.82, coverGradient: "from-[#d55181] to-[#7f00ff]" },
  { appId: 1174180, name: "Red Dead Redemption 2", reviewCount: 48760, pctPositive: 0.91, coverGradient: "from-[#5b86e5] to-[#199e70]" },
  { appId: 2198150, name: "Concord", reviewCount: 3210, pctPositive: 0.12, coverGradient: "from-[#ffb347] to-[#ff5f6d]" },
  { appId: 2183900, name: "Skull and Bones", reviewCount: 5120, pctPositive: 0.34, coverGradient: "from-[#5b86e5] to-[#36d1dc]" },
];

const FILTERS = ["Tendances", "Mieux notés", "Plus commentés", "Pires notes"];

export default function ClassementsPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <Nav />

      <h1 className="mt-8 text-2xl font-bold text-white">Classements</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Données factices pour l&apos;instant — en attente des marts dbt côté pipeline.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((filter, i) => (
          <span
            key={filter}
            className={
              i === 0
                ? "rounded-full bg-gradient-to-r from-brand-blue to-brand-red px-3 py-1 text-xs font-bold text-black"
                : "rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300"
            }
          >
            {filter}
          </span>
        ))}
      </div>

      <div className="mt-6 space-y-2">
        {LEADERBOARD.map((game, i) => (
          <Link
            key={game.appId}
            href={`/games/${game.appId}`}
            className="flex items-center gap-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3 hover:border-white/20"
          >
            <span className="w-5 text-sm font-bold text-neutral-500">{i + 1}</span>
            <div className={`h-10 w-10 flex-shrink-0 rounded-md bg-gradient-to-br ${game.coverGradient}`} />
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">{game.name}</div>
              <div className="text-xs text-neutral-400">{game.reviewCount.toLocaleString("fr-FR")} reviews</div>
            </div>
            <div
              className="rounded-md px-2 py-1 text-xs font-extrabold"
              style={{
                color: game.pctPositive >= 0.5 ? "var(--status-good)" : "var(--status-critical)",
                backgroundColor: "rgba(255,255,255,0.06)",
              }}
            >
              {Math.round(game.pctPositive * 100)}%
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
