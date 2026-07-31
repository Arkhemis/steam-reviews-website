import Image from "next/image";
import Link from "next/link";
import type { TrendingGame } from "@/lib/data/types";

const FALLBACK_GRADIENTS = [
  "from-[#3fa9f5] to-[#ef4a5a]",
  "from-[#199e70] to-[#3987e5]",
  "from-[#d95926] to-[#c98500]",
  "from-[#d55181] to-[#7f00ff]",
];

const compactNumber = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });

export function TrendingGameRow({ game, index }: { game: TrendingGame; index: number }) {
  const rising = game.deltaPct >= 0;
  const color = rising ? "var(--status-good)" : "var(--status-critical)";
  const arrow = rising ? "▲" : "▼";

  return (
    <Link
      href={`/games/${game.appId}`}
      className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 transition-colors hover:border-white/25 hover:bg-white/[0.08]"
    >
      <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-md bg-white/10">
        {game.coverUrl ? (
          <Image src={game.coverUrl} alt="" fill sizes="40px" className="object-cover" />
        ) : (
          <div className={`h-full w-full bg-gradient-to-br ${FALLBACK_GRADIENTS[index % FALLBACK_GRADIENTS.length]}`} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-white">{game.name}</div>
        <div className="text-xs text-neutral-400">
          {compactNumber.format(game.recentReviews)} reviews sur 30j
        </div>
      </div>
      <div className="rounded-md px-2 py-1 text-right text-xs font-extrabold" style={{ color, backgroundColor: "rgba(255,255,255,0.06)" }}>
        <div>{Math.round(game.recentPctPositive * 100)}%</div>
        <div className="font-medium">
          {arrow} {rising ? "+" : ""}
          {game.deltaPct.toFixed(1)} pts
        </div>
      </div>
    </Link>
  );
}
