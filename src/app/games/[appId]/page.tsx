import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Nav } from "@/components/Nav";
import { StatTile } from "@/components/StatTile";
import { getGameStats } from "@/lib/data/gameData";
import {
  LanguagesSection,
  LanguagesSkeleton,
  ReviewsSection,
  ReviewsSkeleton,
  TrendsSection,
  TrendsSkeleton,
} from "./sections";

type GamePageProps = {
  params: Promise<{ appId: string }>;
  searchParams: Promise<{ lang?: string }>;
};

function getSteamRating(pctPositive: number, totalReviews: number): { label: string; color: string } {
  const pct = pctPositive * 100;

  if (pct < 20) {
    if (totalReviews >= 500) return { label: "Extrêmement négatif", color: "var(--status-critical)" };
    if (totalReviews >= 50) return { label: "Très négatif", color: "var(--status-critical)" };
    return { label: "Négatif", color: "var(--status-critical)" };
  }
  if (pct < 40) return { label: "Plutôt négatif", color: "var(--status-critical)" };
  if (pct < 70) return { label: "Moyenne", color: "var(--status-warning)" };
  if (pct < 80) return { label: "Plutôt positif", color: "var(--status-good)" };
  if (totalReviews >= 500) return { label: "Extrêmement positif", color: "var(--status-good)" };
  if (totalReviews >= 50) return { label: "Très positif", color: "var(--status-good)" };
  return { label: "Positif", color: "var(--status-good)" };
}

export default async function GamePage({ params, searchParams }: GamePageProps) {
  const { appId } = await params;
  const { lang } = await searchParams;
  const numericAppId = Number(appId);

  const stats = await getGameStats(numericAppId);

  if (!stats) {
    return (
      <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
        <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-7">
          <Nav />
          <p className="mt-12 text-center text-[#9fb2bd]">Ce jeu est introuvable.</p>
        </div>
      </div>
    );
  }

  // Only `getGameStats` is awaited here: it decides between the page and the
  // 404, and feeds the hero. The three heavier queries run inside their own
  // Suspense boundaries below, so the header and the KPIs reach the browser
  // without waiting on the review set.
  const rating = getSteamRating(stats.pctPositive, stats.totalReviews);

  return (
    <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-7">
        <Nav />

        <div className="mt-6 flex items-center gap-5">
          <div className="relative h-32 w-32 flex-shrink-0 overflow-hidden rounded-2xl bg-white/5">
            {stats.coverUrl && (
              // The LCP element on this route: served through the image optimizer
              // like every other cover, but eagerly — lazy-loading the largest
              // above-the-fold image would only delay it.
              <Image src={stats.coverUrl} alt="" fill sizes="128px" priority className="object-cover" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">{stats.name}</h1>
              <a
                href={`https://store.steampowered.com/app/${stats.appId}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand-blue underline"
              >
                Voir sur Steam ↗
              </a>
            </div>
            <p className="text-xs text-neutral-400">
              {stats.developers.join(", ")}
              {stats.firstReleaseDate ? ` · Sorti le ${new Date(stats.firstReleaseDate).toLocaleDateString("fr-FR")}` : ""} ·{" "}
              {stats.totalReviews.toLocaleString("fr-FR")} reviews analysées
            </p>
            <div className="mt-2 flex gap-2">
              <span
                className="rounded-full px-2.5 py-1 text-xs font-bold text-white"
                style={{
                  background: `linear-gradient(135deg, color-mix(in srgb, ${rating.color} 65%, black), color-mix(in srgb, ${rating.color} 85%, white))`,
                }}
              >
                {Math.round(stats.pctPositive * 100)}% positif ({rating.label})
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
            <Suspense fallback={<TrendsSkeleton />}>
              <TrendsSection appId={numericAppId} />
            </Suspense>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h2 className="mb-2 text-xs uppercase tracking-wide text-neutral-400">Langues</h2>
            <Suspense fallback={<LanguagesSkeleton />}>
              <LanguagesSection appId={numericAppId} />
            </Suspense>
            <Link href={`/carte?app=${stats.appId}`} className="mt-2 block text-center text-xs text-brand-blue">
              Voir sur la carte →
            </Link>
          </div>
        </div>

        <h2 className="mt-8 mb-3 text-xs uppercase tracking-wide text-neutral-400">Reviews les plus votées</h2>
        {/* Clé sur la langue : changer de langue remonte la boundary, donc le
            skeleton revient au lieu de figer la paire précédente pendant la
            requête. */}
        <Suspense key={lang ?? "default"} fallback={<ReviewsSkeleton />}>
          <ReviewsSection appId={numericAppId} lang={lang} />
        </Suspense>

        <div className="mt-8 flex items-center justify-between rounded-xl bg-gradient-to-r from-brand-blue via-brand-glow to-brand-red p-5">
          <div>
            <h3 className="font-bold text-white">⚔️ Comparer ce jeu</h3>
            <p className="text-xs text-white/80">Voir {stats.name} face à un autre jeu, stat contre stat.</p>
          </div>
          <Link href={`/battle?game=${stats.appId}`} className="rounded-full bg-white px-4 py-2 text-xs font-extrabold text-black">
            Lancer un Battle
          </Link>
        </div>
      </div>
    </div>
  );
}
