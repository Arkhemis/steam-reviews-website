import Link from "next/link";
import { LanguageDistribution } from "@/components/LanguageDistribution";
import { Nav } from "@/components/Nav";
import { ScoreEvolutionChart } from "@/components/ScoreEvolutionChart";
import { StatTile } from "@/components/StatTile";
import { TopReviews } from "@/components/TopReviews";
import {
  getGameLanguageDistribution,
  getGameReviewTrends,
  getGameStats,
  getGameTopReviews,
} from "@/lib/data/gameData";

type GamePageProps = {
  params: Promise<{ appId: string }>;
};

export default async function GamePage({ params }: GamePageProps) {
  const { appId } = await params;
  const numericAppId = Number(appId);

  const stats = await getGameStats(numericAppId);

  if (!stats) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-8">
        <Nav />
        <p className="mt-12 text-center text-neutral-400">Ce jeu est introuvable.</p>
      </main>
    );
  }

  const [trends, languages, reviews] = await Promise.all([
    getGameReviewTrends(numericAppId),
    getGameLanguageDistribution(numericAppId),
    getGameTopReviews(numericAppId),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Nav />

      <div className="mt-6 flex items-center gap-5">
        <div
          className="h-32 w-32 flex-shrink-0 rounded-2xl bg-cover bg-center"
          style={stats.coverUrl ? { backgroundImage: `url(${stats.coverUrl})` } : undefined}
        />
        <div>
          <h1 className="text-2xl font-bold text-white">{stats.name}</h1>
          <p className="text-xs text-neutral-400">
            {stats.developers.join(", ")}
            {stats.firstReleaseDate ? ` · Sorti le ${new Date(stats.firstReleaseDate).toLocaleDateString("fr-FR")}` : ""} ·{" "}
            {stats.totalReviews.toLocaleString("fr-FR")} reviews analysées
          </p>
          <div className="mt-2 flex gap-2">
            <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ color: "var(--status-good)", backgroundColor: "rgba(12,163,12,0.12)" }}>
              {Math.round(stats.pctPositive * 100)}% positif — {stats.reviewScoreDesc}
            </span>
            {stats.genres[0] && (
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-neutral-300">{stats.genres[0]}</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-4 gap-3">
        <StatTile label="Score positif" value={`${Math.round(stats.pctPositive * 100)}%`} />
        <StatTile label="Playtime médian" value={`${Math.round(stats.playtimeMedianMinutes / 60)}h`} />
        <StatTile label="Reviews Steam Deck" value={`${Math.round(stats.pctSteamDeck * 100)}%`} />
        <StatTile label="Remboursées" value={`${(stats.pctRefunded * 100).toFixed(1)}%`} />
      </div>

      <div className="mt-8 grid grid-cols-[1.4fr_1fr] gap-5">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-2 text-xs uppercase tracking-wide text-neutral-400">Évolution du score positif</h2>
          <ScoreEvolutionChart trends={trends} />
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-2 text-xs uppercase tracking-wide text-neutral-400">Langues</h2>
          <LanguageDistribution languages={languages} />
          <Link href={`/carte?game=${stats.appId}`} className="mt-2 block text-center text-xs text-brand-cyan">
            Voir sur la carte →
          </Link>
        </div>
      </div>

      <h2 className="mt-8 mb-3 text-xs uppercase tracking-wide text-neutral-400">Reviews les plus votées</h2>
      <TopReviews reviews={reviews} />

      <div className="mt-8 flex items-center justify-between rounded-xl bg-gradient-to-r from-brand-glow via-brand-purple to-brand-cyan p-5">
        <div>
          <h3 className="font-bold text-white">⚔️ Comparer ce jeu</h3>
          <p className="text-xs text-white/80">Voir {stats.name} face à un autre jeu, stat contre stat.</p>
        </div>
        <Link href={`/battle?game=${stats.appId}`} className="rounded-full bg-white px-4 py-2 text-xs font-extrabold text-black">
          Lancer un Battle
        </Link>
      </div>
    </main>
  );
}
