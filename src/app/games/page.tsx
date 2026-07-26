import Link from "next/link";
import { Nav } from "@/components/Nav";

type GameCard = {
  appId: number;
  name: string;
  pctPositive: number;
  coverGradient: string;
};

const GAMES: GameCard[] = [
  { appId: 1086940, name: "Baldur's Gate 3", pctPositive: 0.97, coverGradient: "from-[#ff5f6d] to-[#7f00ff]" },
  { appId: 553850, name: "Helldivers 2", pctPositive: 0.88, coverGradient: "from-[#36d1dc] to-[#5b86e5]" },
  { appId: 620, name: "Portal 2", pctPositive: 0.98, coverGradient: "from-[#7dffb0] to-[#199e70]" },
  { appId: 1245620, name: "Elden Ring", pctPositive: 0.93, coverGradient: "from-[#c98500] to-[#ffb347]" },
  { appId: 1091500, name: "Cyberpunk 2077", pctPositive: 0.82, coverGradient: "from-[#d55181] to-[#7f00ff]" },
  { appId: 1174180, name: "Red Dead Redemption 2", pctPositive: 0.91, coverGradient: "from-[#5b86e5] to-[#199e70]" },
];

export default function GamesIndexPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Nav />

      <h1 className="mt-8 text-2xl font-bold text-white">Jeux</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Données factices pour l&apos;instant — en attente des marts dbt côté pipeline.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {GAMES.map((game) => (
          <Link
            key={game.appId}
            href={`/games/${game.appId}`}
            className="rounded-xl border border-white/10 bg-white/5 p-3 hover:border-white/20"
          >
            <div className={`h-20 w-full rounded-lg bg-gradient-to-br ${game.coverGradient}`} />
            <div className="mt-2 text-sm font-semibold text-white">{game.name}</div>
            <div className="text-xs" style={{ color: "var(--status-good)" }}>
              {Math.round(game.pctPositive * 100)}% positif
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
