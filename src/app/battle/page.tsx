import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { cache } from "react";
import { BattleRivalries } from "@/components/BattleRivalries";
import { DuelArena, type DuelCorner, type DuelQuote } from "@/components/DuelArena";
import { SectionHead } from "@/components/HomeEditorial";
import { Nav } from "@/components/Nav";
import { battleHref, DEFAULT_LANGUAGE, languageFromAcceptLanguage, resolveLanguage, resolveMatchup } from "@/lib/battle";
import { getGameReviewLanguages, getGameStats, getGameTopReviews } from "@/lib/data/gameData";
import type { GameProfile, GameTopReview } from "@/lib/data/types";
import { duelStats, pickQuotes } from "@/lib/duel";
import { LANGUAGE_LABELS, type LanguageKey } from "@/lib/map";
import { SITE_NAME } from "@/lib/site";
import { getSteamRating } from "@/lib/steamRating";

// Le battle : deux jeux réglés en duel au tour par tour, façon Pokémon. Le
// serveur lit les deux fiches, en tire les stats et les répliques ; les coups,
// eux, sont choisis par le joueur dans le navigateur.

type Battle3PageProps = {
  searchParams: Promise<{ game?: string; vs?: string; lang?: string }>;
};

const loadGame = cache(getGameStats);

const enCompact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export async function generateMetadata({ searchParams }: Battle3PageProps): Promise<Metadata> {
  const params = await searchParams;
  const { leftAppId, rightAppId } = resolveMatchup(params.game, params.vs);
  const [left, right] = await Promise.all([loadGame(leftAppId), loadGame(rightAppId)]);
  if (!left || !right) return { title: "Steam game duel", robots: { index: false } };

  const title = `${left.name} vs ${right.name}: turn-based Steam duel`;
  const description =
    `Pick ${left.name} or ${right.name} and fight the CPU turn by turn. Hit points come from playtime, ` +
    "power from positive reviews, and every attack quotes a real Steam review.";
  const url = battleHref(leftAppId, rightAppId);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", siteName: SITE_NAME, locale: "en_US", url, title, description },
  };
}

function quotesOf(reviews: GameTopReview[], up: boolean): DuelQuote[] {
  return pickQuotes(reviews, up).map((r) => ({
    text: r.text,
    author: r.authorPersonaname,
    hours: Math.round(r.authorPlaytimeAtReviewMinutes / 60),
  }));
}

function cornerFor(game: GameProfile, reviews: GameTopReview[]): DuelCorner {
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
    stats: duelStats(game),
    sources: {
      reviews: enCompact.format(game.totalReviews),
      hours: `${Math.round(game.playtimeMedianMinutes / 60)}h`,
      positive: `${Math.round(game.pctPositive * 100)}%`,
      refunded: `${(game.pctRefunded * 100).toFixed(1)}%`,
      deck: `${(game.pctSteamDeck * 100).toFixed(1)}%`,
    },
    cheers: quotesOf(reviews, true),
    jeers: quotesOf(reviews, false),
  };
}

// Ce que chaque chiffre de Steam devient en duel.
const RULES: { stat: string; becomes: string; why: string }[] = [
  {
    stat: "Median playtime",
    becomes: "Hit points",
    why: "Games people stick with take a beating: 0h → 80 HP, 4h → 102, 60h → 168, capped at 200.",
  },
  {
    stat: "Positive reviews",
    becomes: "Power & aim",
    why: "Damage per hit runs from 8 to 32 with the positive share. It also aims the Review Bomb: a loved game rarely misses, a hated one blows itself up.",
  },
  {
    stat: "Reviews",
    becomes: "Initiative & crits",
    why: "The most-reviewed game moves first, and a bigger crowd lands more critical hits: 5% at 1K reviews, 11% at 1M.",
  },
  {
    stat: "Refunds",
    becomes: "Refund risk",
    why: "A Refund Request barely scratches, but it can freeze the target for a turn. The more its players refund, the likelier it sticks.",
  },
  {
    stat: "Steam Deck",
    becomes: "Dodge",
    why: "Portable games are slippery: 3% base dodge, plus eight times the Deck share, up to 30%.",
  },
];

export default async function Battle3Page({ searchParams }: Battle3PageProps) {
  const params = await searchParams;
  const { leftAppId, rightAppId } = resolveMatchup(params.game, params.vs);
  const [left, right] = await Promise.all([loadGame(leftAppId), loadGame(rightAppId)]);

  if (!left || !right) {
    return (
      <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
        <Nav variant="banded" />
        <div className="mx-auto max-w-[640px] px-6 py-16 text-center">
          <p className="font-mono text-[10px] tracking-[0.14em] text-[#7d919c] uppercase">no duel</p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight">One of the two duelists didn&apos;t show up.</p>
          <p className="mt-2 text-sm text-[#9fb2bd]">That game isn&apos;t in the catalogue. Pick another matchup.</p>
          <Link href="/battle" className="mt-6 inline-block rounded-full bg-brand-blue px-[18px] py-2.5 text-sm font-bold text-[#0c1116]">
            Back to the duel
          </Link>
        </div>
        <BattleRivalries leftAppId={leftAppId} rightAppId={rightAppId} />
      </div>
    );
  }

  // Sans `?lang=`, la langue du navigateur ; l'anglais si l'un des deux jeux
  // n'a aucune review dans cette langue.
  const explicit = params.lang !== undefined;
  const wanted = explicit
    ? resolveLanguage(params.lang)
    : (languageFromAcceptLanguage((await headers()).get("accept-language")) ?? DEFAULT_LANGUAGE);
  // Toutes les reviews en vedette dans la langue choisie (quelques dizaines
  // par jeu) : `pickQuotes` y cherche les plus drôles qui tiennent dans une bulle.
  const topReviews = (lang: LanguageKey) =>
    Promise.all([
      getGameTopReviews(leftAppId, { language: lang, perSide: 60 }),
      getGameTopReviews(rightAppId, { language: lang, perSide: 60 }),
    ]);
  const [[wantedLeft, wantedRight], leftLanguages, rightLanguages] = await Promise.all([
    topReviews(wanted),
    getGameReviewLanguages(leftAppId),
    getGameReviewLanguages(rightAppId),
  ]);

  // Le sélecteur ne propose que les langues où les deux jeux ont de quoi se
  // lancer des reviews, les mieux fournies d'abord ; l'anglais et la langue
  // en cours y restent toujours.
  const rightCounts = new Map(rightLanguages.map((l) => [l.language, l.reviewCount]));
  const shared = leftLanguages
    .filter((l) => l.language in LANGUAGE_LABELS && rightCounts.has(l.language))
    .map((l) => ({ key: l.language, count: Math.min(l.reviewCount, rightCounts.get(l.language) ?? 0) }))
    .sort((a, b) => b.count - a.count)
    .map((l) => l.key);

  const fallBack = !explicit && wanted !== DEFAULT_LANGUAGE && !shared.includes(wanted);
  const language = fallBack ? DEFAULT_LANGUAGE : wanted;
  const [leftReviews, rightReviews] = fallBack ? await topReviews(DEFAULT_LANGUAGE) : [wantedLeft, wantedRight];
  const languageKeys = [...new Set([DEFAULT_LANGUAGE, language, ...shared])];
  const languages = languageKeys.map((key) => ({ key, label: LANGUAGE_LABELS[key as LanguageKey] }));

  return (
    <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
      <Nav variant="banded" />

      {/* Plus de bandeau de titre : l'arène suffit à l'œil, le titre reste pour
          les lecteurs d'écran et les moteurs. */}
      <h1 className="sr-only">
        {left.name} vs {right.name}
      </h1>

      <div className="px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-[1320px]">
          {/* Une clé par duel : naviguer vers une autre paire (Random rivalry, Change game…)
              garde la même page, et sans elle l'arène resterait sur le duel terminé. */}
          <DuelArena
            key={`${leftAppId}-${rightAppId}-${language}`}
            left={cornerFor(left, leftReviews)}
            right={cornerFor(right, rightReviews)}
            language={language}
            languages={languages}
            langParam={explicit ? language : undefined}
          />
        </div>
      </div>

      <div className="border-t border-[#1a2530] px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-[1320px]">
          <SectionHead title="How the numbers fight" note="what Steam's stats become in a duel" />
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

      <BattleRivalries leftAppId={leftAppId} rightAppId={rightAppId} lang={explicit ? language : undefined} />
    </div>
  );
}
