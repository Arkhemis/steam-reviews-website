import Link from "next/link";
import { Nav } from "@/components/Nav";
import { ReviewCard } from "@/components/ReviewCard";
import { TrendingGameRow } from "@/components/TrendingGameRow";
import { getFeaturedReview, getSiteStats, getTrendingGames } from "@/lib/data/gameData";

const fullNumber = new Intl.NumberFormat("fr-FR");

export default async function HomePage() {
  const [siteStats, rising, falling, featured] = await Promise.all([
    getSiteStats(),
    getTrendingGames("up", 4),
    getTrendingGames("down", 4),
    getFeaturedReview(),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Nav />

      <div className="mt-12 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-neutral-300">
          <span className="font-bold text-white">{fullNumber.format(siteStats.totalReviews)}</span> reviews
          <span className="text-neutral-600">·</span>
          <span className="font-bold text-white">{fullNumber.format(siteStats.totalGames)}</span> jeux analysés
        </div>
        <h1 className="mx-auto mt-5 max-w-2xl text-4xl font-black tracking-tight text-white sm:text-5xl">
          Qu&apos;est-ce que les joueurs{" "}
          <span className="bg-gradient-to-r from-brand-blue to-brand-red bg-clip-text text-transparent">
            pensent vraiment
          </span>{" "}
          ?
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-neutral-400">
          Toutes les reviews Steam, passées au crible — sans le bruit marketing.
        </p>
        <form action="/games" method="GET" className="mx-auto mt-6 max-w-md">
          <input
            type="text"
            name="q"
            placeholder="🔍 Chercher un jeu, ex. Baldur's Gate 3…"
            className="block w-full rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-neutral-200 placeholder:text-neutral-500 focus:border-white/25 focus:outline-none"
          />
        </form>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <h2 className="mb-3 text-xs uppercase tracking-wide text-neutral-400">🔥 Ça monte (30 derniers jours)</h2>
          <div className="space-y-2">
            {rising.map((game, i) => (
              <TrendingGameRow key={game.appId} game={game} index={i} />
            ))}
          </div>
        </div>
        <div>
          <h2 className="mb-3 text-xs uppercase tracking-wide text-neutral-400">📉 Ça descend (30 derniers jours)</h2>
          <div className="space-y-2">
            {falling.map((game, i) => (
              <TrendingGameRow key={game.appId} game={game} index={i} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 text-center">
        <Link href="/classements" className="text-xs text-brand-blue hover:underline">
          Voir tous les classements →
        </Link>
      </div>

      {featured && (
        <div className="mt-14">
          <h2 className="mb-3 text-xs uppercase tracking-wide text-neutral-400">💬 Une review au hasard</h2>
          <div className="mb-2 flex items-center justify-between">
            <Link href={`/games/${featured.game.appId}`} className="text-sm font-semibold text-white hover:underline">
              {featured.game.name}
            </Link>
            <span className="text-xs text-neutral-500">
              {Math.round(featured.game.pctPositive * 100)}% d&apos;avis positifs
            </span>
          </div>
          <ReviewCard review={featured.review} />
        </div>
      )}

      <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/carte"
          className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#0f2027] via-[#203a43] to-[#2c5364] p-5 transition-transform hover:scale-[1.01]"
        >
          <h3 className="font-bold text-white">🌍 Empreinte linguistique</h3>
          <p className="mt-1 text-xs text-white/75">
            Explore quelles langues dominent les reviews, jeu par jeu ou globalement.
          </p>
        </Link>
        <Link
          href="/battle"
          className="flex items-center justify-center rounded-xl bg-gradient-to-br from-brand-blue via-brand-glow to-brand-red p-5 text-center transition-transform hover:scale-[1.01]"
        >
          <span className="text-lg font-black text-white">
            Compare deux jeux <span className="opacity-60">en face-à-face</span>
          </span>
        </Link>
      </div>
    </main>
  );
}
