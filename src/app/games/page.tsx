import Image from "next/image";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { getTopGames } from "@/lib/data/gameData";

const PAGE_SIZE = 24;

type GamesIndexPageProps = {
  searchParams: Promise<{ q?: string; page?: string }>;
};

function pageHref(page: number, q?: string): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/games?${query}` : "/games";
}

export default async function GamesIndexPage({ searchParams }: GamesIndexPageProps) {
  const { q, page: rawPage } = await searchParams;
  const page = Math.max(1, Number(rawPage) || 1);

  // Asking for one row past the page tells us whether a "next" link is
  // warranted, without a second COUNT(*) over the whole catalogue.
  const rows = await getTopGames(PAGE_SIZE + 1, q, (page - 1) * PAGE_SIZE);
  const games = rows.slice(0, PAGE_SIZE);
  const hasNext = rows.length > PAGE_SIZE;

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
        <p className="mt-6 text-sm text-neutral-400">
          {q ? `Aucun jeu ne correspond à « ${q} ».` : "Plus aucun jeu à cette page."}
        </p>
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

      {(page > 1 || hasNext) && (
        <nav className="mt-8 flex items-center justify-between text-xs" aria-label="Pagination">
          {page > 1 ? (
            <Link
              href={pageHref(page - 1, q)}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-neutral-300 hover:border-white/20"
            >
              ← Précédent
            </Link>
          ) : (
            <span />
          )}
          <span className="text-neutral-500">Page {page}</span>
          {hasNext ? (
            <Link
              href={pageHref(page + 1, q)}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-neutral-300 hover:border-white/20"
            >
              Suivant →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </main>
  );
}
