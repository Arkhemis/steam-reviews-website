import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { ArmyBattlefield, type ArmySheet } from "@/components/ArmyBattlefield";
import { BattleRivalries } from "@/components/BattleRivalries";
import { SectionHead } from "@/components/HomeEditorial";
import { Nav } from "@/components/Nav";
import { defaultSeed, raiseArmy } from "@/lib/armyBattle";
import { battleHref, resolveMatchup, type Side } from "@/lib/battle";
import { getGameStats } from "@/lib/data/gameData";
import type { GameProfile } from "@/lib/data/types";
import { SITE_NAME } from "@/lib/site";
import { getSteamRating } from "@/lib/steamRating";

// « Battle 2 » : la même paire de jeux que `/battle`, mais réglée par deux
// armées de pions au lieu de rounds. Le serveur lit les deux fiches et lève
// les armées ; tout le reste — la bataille, les chances — se joue dans le
// navigateur, à partir d'une graine qui voyage dans l'URL.

type Battle2PageProps = {
  searchParams: Promise<{ game?: string; vs?: string; seed?: string }>;
};

const loadGame = cache(getGameStats);

const enCompact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export async function generateMetadata({ searchParams }: Battle2PageProps): Promise<Metadata> {
  const params = await searchParams;
  const { leftAppId, rightAppId } = resolveMatchup(params.game, params.vs);
  const [left, right] = await Promise.all([loadGame(leftAppId), loadGame(rightAppId)]);
  if (!left || !right) return { title: "Steam army battle", robots: { index: false } };

  const title = `${left.name} vs ${right.name}: Steam army battle`;
  const description =
    `Two armies raised from Steam reviews: ${left.name} and ${right.name} send soldiers by review count, ` +
    "hit points by playtime, accuracy by positive share — and lose deserters to refunds.";
  // La graine n'est qu'une variante de la même page : la canonique l'ignore.
  const url = battleHref(leftAppId, rightAppId, "/battle-2");
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", siteName: SITE_NAME, locale: "en_US", url, title, description },
  };
}

function sheetFor(game: GameProfile, side: Side): ArmySheet {
  const rating = getSteamRating(game.pctPositive, game.totalReviews);
  return {
    fighter: {
      appId: game.appId,
      name: game.name,
      coverUrl: game.coverUrl,
      pct: game.pctPositive,
      ratingLabel: rating.label,
      ratingColor: rating.color,
      totalReviews: game.totalReviews,
    },
    spec: raiseArmy(game, side),
    sources: {
      reviews: enCompact.format(game.totalReviews),
      hours: `${Math.round(game.playtimeMedianMinutes / 60)}h`,
      positive: `${Math.round(game.pctPositive * 100)}%`,
      refunded: `${(game.pctRefunded * 100).toFixed(1)}%`,
      deck: `${(game.pctSteamDeck * 100).toFixed(1)}%`,
    },
  };
}

// Les règles d'engagement : ce que chaque chiffre de Steam devient sur le
// champ, et pourquoi il est tordu comme il l'est.
const RULES: { stat: string; becomes: string; why: string }[] = [
  {
    stat: "Reviews",
    becomes: "Soldiers",
    why: "Every tenfold jump in reviews adds 8 soldiers (1K → 10, 1M → 34, 10M → 42). Linear, the biggest game would field 50× the army and win before the charge.",
  },
  {
    stat: "Median playtime",
    becomes: "Hit points",
    why: "Games people stick with make soldiers that take a beating: 0h → 2 HP, 10h → 5, 150h → 14, capped at 20.",
  },
  {
    stat: "Positive reviews",
    becomes: "Accuracy",
    why: "Taken as is: a 90% positive game lands 9 blows out of 10.",
  },
  {
    stat: "Refunds",
    becomes: "Desertion",
    why: "After every blow taken, a soldier may ask for a refund and walk off the field — refund rate × 6, per hit. Deserters don't die, but they don't fight either.",
  },
  {
    stat: "Steam Deck",
    becomes: "Riders",
    why: "The portable share of the army rides in: Deck share × 10 become fast riders (up to 30%) that reach the front first.",
  },
];

export default async function Battle2Page({ searchParams }: Battle2PageProps) {
  const params = await searchParams;
  const { leftAppId, rightAppId } = resolveMatchup(params.game, params.vs);
  const [left, right] = await Promise.all([loadGame(leftAppId), loadGame(rightAppId)]);

  if (!left || !right) {
    return (
      <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
        <Nav variant="banded" />
        <div className="mx-auto max-w-[640px] px-6 py-16 text-center">
          <p className="font-mono text-[10px] tracking-[0.14em] text-[#7d919c] uppercase">no army</p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight">One of the two armies never showed up.</p>
          <p className="mt-2 text-sm text-[#9fb2bd]">That game isn&apos;t in the catalogue. Pick another matchup.</p>
          <Link href="/battle-2" className="mt-6 inline-block rounded-full bg-brand-blue px-[18px] py-2.5 text-sm font-bold text-[#0c1116]">
            Back to the field
          </Link>
        </div>
        <BattleRivalries leftAppId={leftAppId} rightAppId={rightAppId} path="/battle-2" />
      </div>
    );
  }

  const seedParam = Number(params.seed);
  const seed = Number.isInteger(seedParam) && seedParam >= 0 ? seedParam : defaultSeed(leftAppId, rightAppId);

  return (
    <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
      <Nav variant="banded" />

      <div className="border-b border-[#1a2530] bg-[linear-gradient(115deg,#2a1206_0%,#0c1116_50%,#071526_100%)] px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-[1320px]">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="font-mono text-[11px] tracking-[0.16em] text-brand-blue uppercase">battle 2 · army mode</p>
            <Link
              href={battleHref(leftAppId, rightAppId)}
              className="font-mono text-[10px] tracking-[0.12em] text-[#9fb2bd] uppercase hover:text-brand-blue"
            >
              prefer rounds? classic battle →
            </Link>
            <Link
              href={battleHref(leftAppId, rightAppId, "/battle-3")}
              className="font-mono text-[10px] tracking-[0.12em] text-[#9fb2bd] uppercase hover:text-brand-blue"
            >
              take control? duel mode →
            </Link>
          </div>
          <h1 className="mt-2.5 text-3xl leading-[0.98] font-extrabold tracking-tight text-balance sm:text-5xl">
            {left.name} <span className="font-black text-brand-red italic">vs</span> {right.name}
          </h1>
          <p className="mt-3 max-w-[62ch] text-[15px] text-[#9fb2bd]">
            Every review is a recruit. Two armies raised from Steam&apos;s own numbers march on each other — and the refunders
            run for the exit.
          </p>
        </div>
      </div>

      <div className="px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-[1320px]">
          <ArmyBattlefield key={`${leftAppId}-${rightAppId}`} left={sheetFor(left, "left")} right={sheetFor(right, "right")} initialSeed={seed} />
        </div>
      </div>

      <div className="border-t border-[#1a2530] px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-[1320px]">
          <SectionHead title="Rules of engagement" note="how Steam's numbers become an army" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
            {RULES.map((rule) => (
              <div key={rule.stat} className="rounded-md border border-[#1e2b36] bg-[#0a0f14] p-4">
                <div className="font-mono text-[10px] tracking-[0.12em] text-[#7d919c] uppercase">{rule.stat}</div>
                <div className="mt-1 text-lg font-extrabold tracking-tight">→ {rule.becomes}</div>
                <p className="mt-2 text-[13px] leading-relaxed text-[#9fb2bd]">{rule.why}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <BattleRivalries leftAppId={leftAppId} rightAppId={rightAppId} path="/battle-2" />
    </div>
  );
}
