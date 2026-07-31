import Image from "next/image";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { TrendingGameRow } from "@/components/TrendingGameRow";
import { getRankedGames, getTopGames, getTrendingGames } from "@/lib/data/gameData";
import type { GameStats } from "@/lib/data/types";

const FILTERS = [
  { key: "tendances", label: "Tendances" },
  { key: "mieux-notes", label: "Mieux notés" },
  { key: "plus-commentes", label: "Plus commentés" },
  { key: "pires-notes", label: "Pires notes" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const RANKING_LIMIT = 20;
const MIN_REVIEWS_FOR_RATING = 500;

function isFilterKey(value: string | undefined): value is FilterKey {
  return FILTERS.some((f) => f.key === value);
}

const compactNumber = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });

function RankedGameRow({ game, rank }: { game: GameStats; rank: number }) {
  return (
    <Link
      href={`/games/${game.appId}`}
      className="flex items-center gap-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3 hover:border-white/20"
    >
      <span className="w-5 text-sm font-bold text-neutral-500">{rank}</span>
      <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-md bg-white/10">
        {game.coverUrl && <Image src={game.coverUrl} alt="" fill sizes="40px" className="object-cover" />}
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold text-white">{game.name}</div>
        <div className="text-xs text-neutral-400">{compactNumber.format(game.totalReviews)} reviews</div>
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
  );
}

type ClassementsPageProps = {
  searchParams: Promise<{ filter?: string }>;
};

export default async function ClassementsPage({ searchParams }: ClassementsPageProps) {
  const { filter: rawFilter } = await searchParams;
  const filter: FilterKey = isFilterKey(rawFilter) ? rawFilter : "tendances";

  const trending = filter === "tendances" ? await getTrendingGames("up", RANKING_LIMIT) : null;
  const ranked =
    filter === "mieux-notes"
      ? await getRankedGames("best", RANKING_LIMIT, MIN_REVIEWS_FOR_RATING)
      : filter === "pires-notes"
        ? await getRankedGames("worst", RANKING_LIMIT, MIN_REVIEWS_FOR_RATING)
        : filter === "plus-commentes"
          ? await getTopGames(RANKING_LIMIT)
          : null;

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <Nav />

      <h1 className="mt-8 text-2xl font-bold text-white">Classements</h1>
      <p className="mt-1 text-sm text-neutral-400">
        {filter === "tendances"
          ? "Plus forte progression du taux d'avis positifs sur les 30 derniers jours."
          : `Sur les jeux avec au moins ${MIN_REVIEWS_FOR_RATING} reviews, pour éviter qu'un petit volume ne fausse le classement.`}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "tendances" ? "/classements" : `/classements?filter=${f.key}`}
            className={
              f.key === filter
                ? "rounded-full bg-gradient-to-r from-brand-blue to-brand-red px-3 py-1 text-xs font-bold text-black"
                : "rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300 hover:border-white/20"
            }
          >
            {f.label}
          </Link>
        ))}
      </div>

      {trending && (
        <div className="mt-6 space-y-2">
          {trending.map((game, i) => (
            <TrendingGameRow key={game.appId} game={game} index={i} />
          ))}
        </div>
      )}

      {ranked && (
        <div className="mt-6 space-y-2">
          {ranked.map((game, i) => (
            <RankedGameRow key={game.appId} game={game} rank={i + 1} />
          ))}
        </div>
      )}
    </main>
  );
}
