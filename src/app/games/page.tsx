import Link from "next/link";
import { GameCoverTile } from "@/components/GameCoverTile";
import { GameSearchForm } from "@/components/GameSearchForm";
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
    <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-7">
        <Nav />

        <h1 className="mt-8 text-2xl font-extrabold tracking-tight">Games</h1>
        <p className="mt-1 text-sm text-[#9fb2bd]">The most reviewed games on Steam.</p>

        <GameSearchForm
          placeholder="Search a game, e.g. Baldur's Gate 3…"
          defaultValue={q}
          className="mt-6 max-w-md"
        />

        {games.length === 0 ? (
          <p className="mt-6 text-sm text-[#9fb2bd]">
            {q ? (
              <>
                No game matches “{q}”.{" "}
                <Link href="/games" className="text-brand-blue hover:underline">
                  See every game →
                </Link>
              </>
            ) : (
              "No more games on this page."
            )}
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-3 gap-2.5 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
            {games.map((game) => (
              <GameCoverTile
                key={game.appId}
                appId={game.appId}
                name={game.name}
                coverUrl={game.coverUrl}
                pct={game.pctPositive * 100}
                reviews={game.totalReviews}
                sizes="12vw"
              />
            ))}
          </div>
        )}

        {(page > 1 || hasNext) && (
          <nav className="mt-8 flex items-center justify-between text-xs" aria-label="Pagination">
            {page > 1 ? (
              <Link
                href={pageHref(page - 1, q)}
                className="rounded-full border border-[#24333f] px-4 py-2 text-[#9fb2bd] hover:border-white/30"
              >
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="text-[#5f7481]">Page {page}</span>
            {hasNext ? (
              <Link
                href={pageHref(page + 1, q)}
                className="rounded-full border border-[#24333f] px-4 py-2 text-[#9fb2bd] hover:border-white/30"
              >
                Next →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </div>
  );
}
