import Image from "next/image";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { getTopGames } from "@/lib/data/gameData";

type GamesIndexPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function GamesIndexPage({ searchParams }: GamesIndexPageProps) {
  const { q } = await searchParams;
  const games = await getTopGames(24, q);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Nav />

      <h1 className="mt-8 text-2xl font-bold text-white">Jeux</h1>
      <p className="mt-1 text-sm text-neutral-400">Les jeux les plus commentés sur Steam.</p>

      <form className="mt-6" action="/games">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="🔍 Chercher un jeu, ex. Baldur's Gate 3…"
          className="block w-full max-w-md rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-neutral-300 placeholder:text-neutral-500 focus:outline-none"
        />
      </form>

      {games.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-400">Aucun jeu ne correspond à « {q} ».</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {games.map((game) => (
            <Link
              key={game.appId}
              href={`/games/${game.appId}`}
              className="rounded-xl border border-white/10 bg-white/5 p-3 hover:border-white/20"
            >
              <div className="relative h-20 w-full overflow-hidden rounded-lg bg-white/10">
                {game.coverUrl && (
                  <Image src={game.coverUrl} alt="" fill sizes="160px" className="object-cover" />
                )}
              </div>
              <div className="mt-2 text-sm font-semibold text-white">{game.name}</div>
              <div className="text-xs" style={{ color: "var(--status-good)" }}>
                {Math.round(game.pctPositive * 100)}% positif
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
