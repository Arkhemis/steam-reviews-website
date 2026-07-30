import Link from "next/link";
import { Nav } from "@/components/Nav";

type TrendingGame = {
  appId: number;
  name: string;
  changeLabel: string;
  pctPositive: number;
  coverGradient: string;
  direction: "up" | "down";
};

const RISING: TrendingGame[] = [
  { appId: 1086940, name: "Baldur's Gate 3", changeLabel: "+4.2% cette semaine", pctPositive: 0.97, coverGradient: "from-[#ff5f6d] to-[#7f00ff]", direction: "up" },
  { appId: 553850, name: "Helldivers 2", changeLabel: "+2.8% cette semaine", pctPositive: 0.88, coverGradient: "from-[#36d1dc] to-[#5b86e5]", direction: "up" },
];

const FALLING: TrendingGame[] = [
  { appId: 2198150, name: "Concord", changeLabel: "-19% cette semaine", pctPositive: 0.12, coverGradient: "from-[#ffb347] to-[#ff5f6d]", direction: "down" },
  { appId: 2183900, name: "Skull and Bones", changeLabel: "-6% cette semaine", pctPositive: 0.34, coverGradient: "from-[#5b86e5] to-[#36d1dc]", direction: "down" },
];

function TrendingRow({ game }: { game: TrendingGame }) {
  const color = game.direction === "up" ? "var(--status-good)" : "var(--status-critical)";
  const arrow = game.direction === "up" ? "▲" : "▼";
  return (
    <Link
      href={`/games/${game.appId}`}
      className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 hover:border-white/20"
    >
      <div className={`h-8 w-8 flex-shrink-0 rounded-md bg-gradient-to-br ${game.coverGradient}`} />
      <div className="flex-1">
        <div className="text-sm font-semibold text-white">{game.name}</div>
        <div className="text-xs text-neutral-400">{game.changeLabel}</div>
      </div>
      <div className="rounded-md px-2 py-1 text-xs font-extrabold" style={{ color, backgroundColor: "rgba(255,255,255,0.06)" }}>
        {arrow} {Math.round(game.pctPositive * 100)}%
      </div>
    </Link>
  );
}

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Nav />

      <div className="mt-10 text-center">
        <div className="text-xs uppercase tracking-wide text-neutral-400">
          4 049 767 reviews · 53 858 jeux analysés
        </div>
        <h1 className="mx-auto mt-3 max-w-2xl bg-gradient-to-r from-brand-blue to-brand-red bg-clip-text text-3xl font-black text-transparent">
          Qu&apos;est-ce que les joueurs pensent vraiment ?
        </h1>
        <input
          type="text"
          placeholder="🔍 Chercher un jeu, ex. Baldur's Gate 3…"
          className="mx-auto mt-6 block w-full max-w-md rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-neutral-300 placeholder:text-neutral-500 focus:outline-none"
        />
      </div>

      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <h2 className="mb-3 text-xs uppercase tracking-wide text-neutral-400">🔥 Ça monte</h2>
          <div className="space-y-2">
            {RISING.map((game) => (
              <TrendingRow key={game.appId} game={game} />
            ))}
          </div>
        </div>
        <div>
          <h2 className="mb-3 text-xs uppercase tracking-wide text-neutral-400">📉 Ça descend</h2>
          <div className="space-y-2">
            {FALLING.map((game) => (
              <TrendingRow key={game.appId} game={game} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 text-center">
        <Link href="/classements" className="text-xs text-brand-blue">
          Voir tous les classements →
        </Link>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/carte"
          className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#0f2027] via-[#203a43] to-[#2c5364] p-5"
        >
          <h3 className="font-bold text-white">🌍 Empreinte linguistique</h3>
          <p className="mt-1 text-xs text-white/75">
            Explore quelles langues dominent les reviews, jeu par jeu ou globalement.
          </p>
        </Link>
        <Link
          href="/battle"
          className="flex items-center justify-center rounded-xl bg-gradient-to-br from-brand-blue via-brand-glow to-brand-red p-5 text-center"
        >
          <span className="text-lg font-black text-white">
            BG3 <span className="opacity-60">vs</span> Starfield
          </span>
        </Link>
      </div>
    </main>
  );
}
