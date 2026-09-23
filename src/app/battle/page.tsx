import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cache, Suspense } from "react";
import { BattleArena, type BattleFighter } from "@/components/BattleArena";
import { BattleReviews } from "@/components/BattleReviews";
import { BattleRivalries } from "@/components/BattleRivalries";
import { Nav } from "@/components/Nav";
import { battleHref, battleOutcome, buildRounds, resolveMatchup } from "@/lib/battle";
import { getGameStats, getGameTopReviews } from "@/lib/data/gameData";
import type { GameProfile } from "@/lib/data/types";
import { SITE_NAME } from "@/lib/site";
import { resolveSteamHeroArt } from "@/lib/steamArtwork";
import { getSteamRating } from "@/lib/steamRating";

type BattlePageProps = {
  searchParams: Promise<{ game?: string; vs?: string }>;
};

// `generateMetadata` et la page lisent les deux mêmes fiches : une requête par
// jeu et par rendu.
const loadGame = cache(getGameStats);

export async function generateMetadata({ searchParams }: BattlePageProps): Promise<Metadata> {
  const params = await searchParams;
  const { leftAppId, rightAppId } = resolveMatchup(params.game, params.vs);
  const [left, right] = await Promise.all([loadGame(leftAppId), loadGame(rightAppId)]);
  if (!left || !right) {
    return { title: "Steam game battle: compare two games", robots: { index: false } };
  }

  const title = `${left.name} vs ${right.name}: Steam review battle`;
  const description =
    `${left.name} (${Math.round(left.pctPositive * 100)}% positive) against ${right.name} ` +
    `(${Math.round(right.pctPositive * 100)}% positive), round by round: approval, playtime, review volume, refunds, Steam Deck and revenue.`;
  const url = battleHref(leftAppId, rightAppId);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", siteName: SITE_NAME, locale: "en_US", url, title, description },
  };
}

// L'illustration de chaque camp tâte le CDN de Steam : sa propre boundary,
// pour que l'arène s'affiche sans l'attendre.
async function FighterArt({ appId }: { appId: number }) {
  const art = await resolveSteamHeroArt(appId);
  if (!art) return null;
  return <Image src={art} alt="" fill sizes="60vw" className="object-cover" />;
}

function toFighter(game: GameProfile): BattleFighter {
  const rating = getSteamRating(game.pctPositive, game.totalReviews);
  return {
    appId: game.appId,
    name: game.name,
    coverUrl: game.coverUrl,
    pct: game.pctPositive,
    ratingLabel: rating.label,
    ratingColor: rating.color,
    totalReviews: game.totalReviews,
  };
}

export default async function BattlePage({ searchParams }: BattlePageProps) {
  const params = await searchParams;
  const { leftAppId, rightAppId } = resolveMatchup(params.game, params.vs);

  const [left, right] = await Promise.all([loadGame(leftAppId), loadGame(rightAppId)]);

  if (!left || !right) {
    return (
      <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
        <Nav variant="banded" />
        <div className="mx-auto max-w-[640px] px-6 py-16 text-center">
          <p className="font-mono text-[10px] tracking-[0.14em] text-[#7d919c] uppercase">no contest</p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight">One of the two fighters didn&apos;t show up.</p>
          <p className="mt-2 text-sm text-[#9fb2bd]">That game isn&apos;t in the catalogue. Pick another matchup.</p>
          <Link
            href="/battle"
            className="mt-6 inline-block rounded-full bg-brand-blue px-[18px] py-2.5 text-sm font-bold text-[#0c1116]"
          >
            Back to the arena
          </Link>
        </div>
        <BattleRivalries leftAppId={leftAppId} rightAppId={rightAppId} path="/battle" />
      </div>
    );
  }

  // Une review par camp suffit : la positive la plus votée et la négative la
  // plus votée de chaque jeu, quatre lignes en tout.
  const [leftReviews, rightReviews] = await Promise.all([
    getGameTopReviews(leftAppId, { perSide: 1 }),
    getGameTopReviews(rightAppId, { perSide: 1 }),
  ]);

  const rounds = buildRounds(left, right);
  const outcome = battleOutcome(rounds);

  return (
    <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
      <Nav variant="banded" />

      <BattleArena
        left={toFighter(left)}
        right={toFighter(right)}
        leftArt={
          <Suspense fallback={null}>
            <FighterArt appId={leftAppId} />
          </Suspense>
        }
        rightArt={
          <Suspense fallback={null}>
            <FighterArt appId={rightAppId} />
          </Suspense>
        }
        rounds={rounds}
        outcome={outcome}
      />

      <div className="px-5 pb-2 text-center sm:px-8">
        <Link
          href={battleHref(leftAppId, rightAppId, "/battle-2")}
          className="font-mono text-[10px] tracking-[0.12em] text-brand-blue uppercase hover:underline"
        >
          settle it with armies instead → battle 2
        </Link>
        <span className="px-2 font-mono text-[10px] text-[#5f7481]">·</span>
        <Link
          href={battleHref(leftAppId, rightAppId, "/battle-3")}
          className="font-mono text-[10px] tracking-[0.12em] text-brand-blue uppercase hover:underline"
        >
          or fight it yourself → battle 3
        </Link>
      </div>

      <div className="border-t border-[#1a2530] px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-[1320px]">
          <BattleReviews
            left={{
              name: left.name,
              positive: leftReviews.find((r) => r.votedUp),
              negative: leftReviews.find((r) => !r.votedUp),
            }}
            right={{
              name: right.name,
              positive: rightReviews.find((r) => r.votedUp),
              negative: rightReviews.find((r) => !r.votedUp),
            }}
          />
        </div>
      </div>

      <BattleRivalries leftAppId={leftAppId} rightAppId={rightAppId} path="/battle" />
    </div>
  );
}
