import Image from "next/image";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { EmptyReviewCard, ReviewCard } from "@/components/ReviewCard";
import { getGameStats, getGameTopReviews } from "@/lib/data/gameData";
import type { GameStats } from "@/lib/data/types";

const DEFAULT_LEFT_APP_ID = 1086940; // Baldur's Gate III
const DEFAULT_RIGHT_APP_ID = 1716740; // Starfield

type BattlePageProps = {
  searchParams: Promise<{ game?: string; vs?: string }>;
};

type BattleStat = {
  label: string;
  left: string;
  right: string;
  leftFillPct: number;
  rightFillPct: number;
  leftWins: boolean;
  rightWins: boolean;
};

const compactNumber = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });

function buildStats(left: GameStats, right: GameStats): BattleStat[] {
  function stat(
    label: string,
    leftValue: number,
    rightValue: number,
    format: (n: number) => string,
    higherIsBetter: boolean,
    // Percentage-type stats already live on a fixed 0-100 scale, so each side's bar
    // length should reflect its own value directly. Count-type stats have no fixed
    // max, so they're scaled against whichever side is larger — the leader's bar
    // reaches the edge, the other is proportionally shorter. Either way the two
    // bars encode true magnitude, not an arbitrary share of their combined total.
    scaleMax: number = 100,
  ): BattleStat {
    const leftFillPct = scaleMax > 0 ? Math.min(100, (leftValue / scaleMax) * 100) : 0;
    const rightFillPct = scaleMax > 0 ? Math.min(100, (rightValue / scaleMax) * 100) : 0;
    const leftWins = higherIsBetter ? leftValue > rightValue : leftValue < rightValue;
    const rightWins = higherIsBetter ? rightValue > leftValue : rightValue < leftValue;
    return { label, left: format(leftValue), right: format(rightValue), leftFillPct, rightFillPct, leftWins, rightWins };
  }

  return [
    stat("Score positif", left.pctPositive * 100, right.pctPositive * 100, (n) => `${Math.round(n)}%`, true),
    stat(
      "Playtime médian",
      left.playtimeMedianMinutes,
      right.playtimeMedianMinutes,
      (n) => `${Math.round(n / 60)}h`,
      true,
      Math.max(left.playtimeMedianMinutes, right.playtimeMedianMinutes),
    ),
    stat(
      "Volume de reviews",
      left.totalReviews,
      right.totalReviews,
      (n) => compactNumber.format(n),
      true,
      Math.max(left.totalReviews, right.totalReviews),
    ),
    stat("Taux de remboursement", left.pctRefunded * 100, right.pctRefunded * 100, (n) => `${n.toFixed(1)}%`, false),
  ];
}

export default async function BattlePage({ searchParams }: BattlePageProps) {
  const params = await searchParams;

  let leftAppId = Number(params.game) || DEFAULT_LEFT_APP_ID;
  let rightAppId = Number(params.vs) || DEFAULT_RIGHT_APP_ID;
  if (rightAppId === leftAppId) {
    rightAppId = leftAppId === DEFAULT_LEFT_APP_ID ? DEFAULT_RIGHT_APP_ID : DEFAULT_LEFT_APP_ID;
  }

  const [left, right] = await Promise.all([getGameStats(leftAppId), getGameStats(rightAppId)]);

  if (!left || !right) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-8">
        <Nav />
        <p className="mt-12 text-center text-neutral-400">Un des deux jeux est introuvable.</p>
      </main>
    );
  }

  const [leftReviews, rightReviews] = await Promise.all([getGameTopReviews(leftAppId), getGameTopReviews(rightAppId)]);
  const leftTopReview = leftReviews.find((review) => review.votedUp);
  const rightTopReview = rightReviews.find((review) => review.votedUp);

  const stats = buildStats(left, right);
  const leftWinCount = stats.filter((s) => s.leftWins).length;
  const rightWinCount = stats.filter((s) => s.rightWins).length;
  const winner = leftWinCount === rightWinCount ? null : leftWinCount > rightWinCount ? left : right;

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <Nav />

      <p className="mt-6 text-center text-sm text-neutral-400">
        Face-à-face 100% calculé à partir des données existantes — pas de vote, pas de compte.
      </p>

      <div className="mt-6 flex items-center justify-center gap-8">
        {[left, right].map((game, i) => (
          <Link key={game.appId} href={`/games/${game.appId}`} className="flex flex-col items-center gap-2">
            <div className="relative h-24 w-24 overflow-hidden rounded-2xl bg-white/10">
              {game.coverUrl && <Image src={game.coverUrl} alt="" fill sizes="96px" className="object-cover" />}
            </div>
            <h2 className="text-lg font-bold text-white">{game.name}</h2>
            <div
              className={
                i === 0
                  ? "bg-gradient-to-r from-brand-cyan to-brand-purple bg-clip-text text-2xl font-black text-transparent"
                  : "text-2xl font-black text-neutral-300"
              }
            >
              {Math.round(game.pctPositive * 100)}%
            </div>
          </Link>
        ))}
      </div>

      {winner && (
        <div
          className="mx-auto mt-6 max-w-md rounded-lg border border-white/10 px-4 py-2 text-center text-sm"
          style={{ backgroundColor: "rgba(12,163,12,0.08)", color: "var(--status-good)" }}
        >
          🏆 {winner.name} l&apos;emporte sur {Math.max(leftWinCount, rightWinCount)} critères sur {stats.length}
        </div>
      )}

      <div className="mx-auto mt-6 max-w-2xl space-y-4">
        {stats.map((stat) => (
          <div key={stat.label}>
            <div className="mb-1 text-center text-xs uppercase tracking-wide text-neutral-400">{stat.label}</div>
            <div className="flex items-center gap-3">
              <span className="w-16 text-right text-sm font-bold text-white">{stat.left}</span>
              <div className="flex h-2.5 flex-1 items-stretch gap-[2px]">
                <div className="flex h-full flex-1 justify-end">
                  <div
                    className="h-full rounded-l-[4px]"
                    style={{ width: `${stat.leftFillPct}%`, backgroundColor: "var(--series-1)" }}
                  />
                </div>
                <div className="flex h-full flex-1 justify-start">
                  <div
                    className="h-full rounded-r-[4px]"
                    style={{ width: `${stat.rightFillPct}%`, backgroundColor: "var(--series-2)" }}
                  />
                </div>
              </div>
              <span className="w-16 text-sm font-bold text-white">{stat.right}</span>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mx-auto mt-8 mb-3 max-w-2xl text-xs uppercase tracking-wide text-neutral-400">
        Meilleure review de chaque côté
      </h2>
      <div className="mx-auto grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        {[
          { game: left, review: leftTopReview },
          { game: right, review: rightTopReview },
        ].map(({ game, review }) => (
          <div key={game.appId}>
            <div className="mb-1 text-xs text-neutral-400">{game.name}</div>
            {review ? <ReviewCard review={review} /> : <EmptyReviewCard label="Pas de review positive disponible." />}
          </div>
        ))}
      </div>

      <div className="mx-auto mt-8 flex max-w-2xl items-center justify-center gap-2">
        <div className="w-full max-w-sm truncate rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-neutral-400">
          steam.reviews/battle?game={left.appId}&vs={right.appId}
        </div>
        <button className="rounded-full bg-gradient-to-r from-brand-cyan to-brand-purple px-4 py-2 text-xs font-bold text-black">
          Copier le lien
        </button>
      </div>
    </main>
  );
}
