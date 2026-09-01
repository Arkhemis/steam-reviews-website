import { GameCoverTile } from "@/components/GameCoverTile";

type ShelfGame = {
  appId: number;
  name: string;
  coverUrl: string | null;
  pct: number;
  deltaPct: number;
};

// Builds a smooth closed ridge path from a series of 0..1 points, purely as background
// texture behind the cover shelf (not tied to real data — same decorative technique as
// the source design).
function ridgePath(points: number[], base: number, amplitude: number, baseline: number): string {
  const width = 1200 / (points.length - 1);
  let d = `M0 ${baseline - points[0] * amplitude}`;
  for (let i = 1; i < points.length; i++) {
    const x = i * width;
    const prevX = (i - 1) * width;
    d += ` C${prevX + width / 2} ${baseline - points[i - 1] * amplitude} ${x - width / 2} ${baseline - points[i] * amplitude} ${x} ${baseline - points[i] * amplitude}`;
  }
  return `${d} L1200 ${base} L0 ${base} Z`;
}

const RIDGES = [
  { d: ridgePath([0.42, 0.5, 0.46, 0.58, 0.54, 0.66, 0.62, 0.74, 0.7, 0.78], 420, 200, 320), fill: "#0d2c46" },
  { d: ridgePath([0.3, 0.36, 0.44, 0.4, 0.52, 0.48, 0.58, 0.54, 0.62, 0.6], 420, 170, 350), fill: "#123f5e" },
  { d: ridgePath([0.2, 0.26, 0.22, 0.34, 0.3, 0.4, 0.36, 0.44, 0.4, 0.48], 420, 140, 380), fill: "#1d5f86" },
];

export function HeroShelf({ games }: { games: ShelfGame[] }) {
  return (
    <div className="relative mt-4 h-[300px] sm:h-[380px] lg:h-[430px]">
      <svg
        viewBox="0 0 1200 460"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-0 h-[200px] w-full sm:h-[240px] lg:h-[280px]"
      >
        {RIDGES.map((r) => (
          <path key={r.fill} d={r.d} fill={r.fill} fillOpacity={0.5} />
        ))}
      </svg>
      <div className="absolute inset-x-3 top-0 bottom-9 sm:inset-x-7">
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-[#24333f]">
          <span className="absolute left-0 -top-[9px] bg-[#0c1116] pr-2 font-mono text-[10px] text-neutral-500">
            100%
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 border-t border-[#24333f]">
          <span className="absolute left-0 -top-[9px] bg-[#0c1116] pr-2 font-mono text-[10px] text-neutral-500">
            0%
          </span>
        </div>
        {games.map((game, i) => (
          <div
            key={game.appId}
            className="absolute w-[8.4%]"
            style={{ left: `${3 + i * 9.6}%`, top: `${(100 - game.pct) * 0.78}%` }}
          >
            <div className="shadow-[0_14px_34px_rgba(0,0,0,0.55)]">
              <GameCoverTile
                appId={game.appId}
                name={game.name}
                coverUrl={game.coverUrl}
                pct={game.pct}
                deltaPct={game.deltaPct}
                sizes="8vw"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
