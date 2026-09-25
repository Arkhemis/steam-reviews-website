import Image from "next/image";
import Link from "next/link";
import { verdictColor } from "@/components/GameCoverTile";
import { SectionHead } from "@/components/HomeEditorial";
import { InfoHint } from "@/components/InfoHint";
import { PointList } from "@/components/PointList";
import { StatTile } from "@/components/StatTile";
import type { GameReviewSummary } from "@/lib/data/types";
import { type CrowdComparison, type LibraryGame, type LibraryInsights, MIN_REVIEWS_TO_RANK } from "@/lib/library";
import type { SteamPlayer } from "@/lib/steamApi";
import { getSteamRating } from "@/lib/steamRating";

const enFull = new Intl.NumberFormat("en-US");

export function formatPlaytime(minutes: number): string {
  if (minutes === 0) return "never played";
  if (minutes < 60) return `${minutes} min`;
  return `${enFull.format(Math.round(minutes / 60))} h`;
}

function formatPct(share: number | null): string {
  return share === null ? "—" : `${Math.round(share * 100)}%`;
}

// --- En-tête -----------------------------------------------------------------

export function PlayerHeader({ player, isOwner }: { player: SteamPlayer; isOwner: boolean }) {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-4">
      <Image src={player.avatarUrl} alt="" width={64} height={64} className="rounded-md" />
      <div className="min-w-0 flex-1">
        <h1 className="m-0 truncate text-2xl font-extrabold tracking-tight">{player.name}</h1>
        <a
          href={player.profileUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-[#9fb2bd] hover:text-brand-blue"
        >
          Steam profile ↗
        </a>
      </div>
      {isOwner && (
        <form action="/api/auth/logout" method="post" className="flex items-center gap-3 text-sm text-[#9fb2bd]">
          Signed in through Steam
          <button type="submit" className="rounded-md border border-[#1e2b36] px-3 py-1.5 hover:border-brand-blue">
            Sign out
          </button>
        </form>
      )}
    </div>
  );
}

// --- Chiffres clés -----------------------------------------------------------

export function LibraryKpis({ insights }: { insights: LibraryInsights }) {
  const hidden = insights.playtimeHidden;
  return (
    <div className="mt-6 grid grid-cols-2 rounded-md border border-[#1e2b36] bg-[#0a0f14] lg:grid-cols-4">
      <StatTile
        label="Games owned"
        value={enFull.format(insights.gameCount)}
        note={hidden ? "playtime hidden on Steam" : `${enFull.format(insights.playedCount)} launched at least once`}
        className="border-r border-b border-[#16202a] lg:border-b-0"
      />
      <StatTile
        label="Time played"
        value={hidden ? "hidden" : formatPlaytime(insights.totalPlaytimeMinutes)}
        note={hidden ? "Steam shares no playtime" : "across the whole library"}
        className="border-b border-[#16202a] lg:border-r lg:border-b-0"
      />
      {hidden ? (
        <StatTile
          label="Rated by players"
          value={formatPct(insights.meanScore)}
          note="average, game by game"
          hint="The average share of positive Steam reviews of the games you own, one game one vote. With playtime visible, it would be weighted by the time spent on each game."
          className="border-r border-[#16202a]"
        />
      ) : (
        <StatTile
          label="Rated by players"
          value={formatPct(insights.playtimeWeightedScore)}
          note={`${formatPct(insights.meanScore)} game by game`}
          hint="The share of positive Steam reviews of the games you own, weighted by the time you spent on each one: a game you played 300 hours counts 300 times more than one you tried for an hour. The note below is the plain average, one game one vote."
          className="border-r border-[#16202a]"
        />
      )}
      <StatTile
        label="In our catalogue"
        value={enFull.format(insights.ratedCount)}
        note={`of ${enFull.format(insights.gameCount)} games`}
        hint="Games steam.reviews has review data for. Tools, soundtracks, demos and games without loaded reviews are left out of the scores."
      />
    </div>
  );
}

/** Le bandeau qui explique pourquoi la moitié de la page manque. */
export function HiddenPlaytimeNotice({ isOwner }: { isOwner: boolean }) {
  return (
    <p className="mt-4 rounded-md border border-[#1e2b36] px-4 py-3 text-sm text-[#9fb2bd]">
      Steam shows no playtime for {isOwner ? "your" : "this"} library, so the lists built on it (most played, backlog,
      guilty pleasures) are left out.
      {isOwner && (
        <>
          {" "}
          To bring them back, untick <strong className="text-[#eef2f4]">Always keep my total playtime private</strong>{" "}
          under Game details in{" "}
          <a
            href="https://steamcommunity.com/my/edit/settings"
            target="_blank"
            rel="noreferrer"
            className="text-brand-blue hover:underline"
          >
            your Steam privacy settings
          </a>
          .
        </>
      )}
    </p>
  );
}

// --- Répartition des verdicts -------------------------------------------------

export function VerdictBreakdown({ insights }: { insights: LibraryInsights }) {
  if (insights.ratedCount === 0) return null;

  return (
    <section className="mt-10">
      <SectionHead title="What Steam thinks of your games" note="games you own, by Steam's rating" />
      {/* Chaque segment a un `title` pour le survol ; la légende porte les
          libellés et les nombres, la couleur n'est jamais seule. */}
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-[4px]" role="img" aria-label="Games owned by Steam rating">
        {insights.verdicts.map((verdict) => (
          <span
            key={verdict.label}
            title={`${verdict.label}: ${enFull.format(verdict.count)} games, ${formatPlaytime(verdict.playtimeMinutes)}`}
            style={{ flexGrow: verdict.count, backgroundColor: verdict.color }}
          />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {insights.verdicts.map((verdict) => (
          <li key={verdict.label} className="flex items-baseline gap-2.5 text-sm">
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: verdict.color }} />
            <span className="flex-1 text-[#cfdae1]">{verdict.label}</span>
            <span className="font-mono text-[#eef2f4]">{enFull.format(verdict.count)}</span>
            <span className="w-20 text-right font-mono text-xs text-[#7d919c]">
              {formatPlaytime(verdict.playtimeMinutes)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// --- Listes de jeux ------------------------------------------------------------

function GameThumb({ game }: { game: LibraryGame }) {
  return (
    <span className="relative block aspect-[2/3] w-11 shrink-0 overflow-hidden rounded-[3px] bg-white/5">
      {game.stats?.coverUrl && <Image src={game.stats.coverUrl} alt="" fill sizes="44px" className="object-cover" />}
    </span>
  );
}

function GameRow({ game, detail }: { game: LibraryGame; detail: string }) {
  const rating = game.stats ? getSteamRating(game.stats.pctPositive, game.stats.totalReviews) : null;
  const body = (
    <>
      <GameThumb game={game} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-[#eef2f4]">{game.name}</span>
        <span className="block font-mono text-[11px] text-[#7d919c]">{detail}</span>
      </span>
      {game.stats && rating ? (
        <span className="shrink-0 text-right">
          <span className="block font-mono text-sm" style={{ color: verdictColor(game.stats.pctPositive * 100) }}>
            {Math.round(game.stats.pctPositive * 100)}%
          </span>
          <span className="block text-[10px] text-[#7d919c]">{rating.label}</span>
        </span>
      ) : (
        <span className="shrink-0 text-[10px] text-[#5f7481]">not in catalogue</span>
      )}
    </>
  );

  return (
    <li>
      {game.stats ? (
        <Link
          href={`/games/${game.appId}`}
          className="flex items-center gap-3 rounded-[5px] border border-[#1e2b36] p-2.5 transition-colors hover:border-brand-blue"
        >
          {body}
        </Link>
      ) : (
        <div className="flex items-center gap-3 rounded-[5px] border border-[#1e2b36] p-2.5">{body}</div>
      )}
    </li>
  );
}

export function MostPlayed({ games }: { games: LibraryGame[] }) {
  if (games.length === 0) return null;
  return (
    <section className="mt-10">
      <SectionHead title="Most played" note="where your hours went" />
      <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((game) => (
          <GameRow
            key={game.appId}
            game={game}
            detail={
              game.playtime2WeeksMinutes > 0
                ? `${formatPlaytime(game.playtimeMinutes)} · ${formatPlaytime(game.playtime2WeeksMinutes)} last 2 weeks`
                : formatPlaytime(game.playtimeMinutes)
            }
          />
        ))}
      </ul>
    </section>
  );
}

function ShortList({
  title,
  note,
  hint,
  empty,
  children,
}: {
  title: string;
  note: string;
  hint: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="m-0 flex items-center gap-2 text-lg font-extrabold tracking-tight">
        {title}
        <InfoHint text={hint} />
      </h3>
      <p className="mt-0.5 mb-3 text-sm text-[#7d919c]">{note}</p>
      {empty ? (
        <p className="text-sm text-[#5f7481]">Nothing here.</p>
      ) : (
        <ul className="space-y-2">{children}</ul>
      )}
    </div>
  );
}

function crowdDetail(game: CrowdComparison): string {
  return `${formatPlaytime(game.playtimeMinutes)} · ${game.ratio.toFixed(1)}× the median reviewer`;
}

function ratingDetail(game: LibraryGame): string {
  return `${enFull.format(game.stats!.totalReviews)} reviews`;
}

export function LibraryShortLists({ insights }: { insights: LibraryInsights }) {
  if (insights.playtimeHidden) {
    return (
      <section className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <ShortList
          title="Best rated you own"
          note="the games players love most"
          hint={`Your games ranked by their share of positive Steam reviews. Games with fewer than ${MIN_REVIEWS_TO_RANK} reviews are left out.`}
          empty={insights.bestRated.length === 0}
        >
          {insights.bestRated.map((game) => (
            <GameRow key={game.appId} game={game} detail={ratingDetail(game)} />
          ))}
        </ShortList>
        <ShortList
          title="Worst rated you own"
          note="the ones players regret"
          hint={`Your games with the lowest share of positive Steam reviews. Games with fewer than ${MIN_REVIEWS_TO_RANK} reviews are left out.`}
          empty={insights.worstRated.length === 0}
        >
          {insights.worstRated.map((game) => (
            <GameRow key={game.appId} game={game} detail={ratingDetail(game)} />
          ))}
        </ShortList>
      </section>
    );
  }

  return (
    <section className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-3">
      <ShortList
        title="Best of your backlog"
        note="never launched, loved by players"
        hint={`Games you own but never launched, ranked by their share of positive reviews. Games with fewer than ${MIN_REVIEWS_TO_RANK} reviews are left out.`}
        empty={insights.backlogBest.length === 0}
      >
        {insights.backlogBest.map((game) => (
          <GameRow key={game.appId} game={game} detail={ratingDetail(game)} />
        ))}
      </ShortList>
      <ShortList
        title="Guilty pleasures"
        note="rated Mixed or worse, played anyway"
        hint="Games under 70% positive reviews on Steam (Mixed or below) that you played for at least an hour, most played first."
        empty={insights.guiltyPleasures.length === 0}
      >
        {insights.guiltyPleasures.map((game) => (
          <GameRow key={game.appId} game={game} detail={formatPlaytime(game.playtimeMinutes)} />
        ))}
      </ShortList>
      <ShortList
        title="Ahead of the crowd"
        note="you played them far longer than most"
        hint="Your playtime against the median playtime of the players who reviewed the game on Steam. Only games where both are at least an hour long, and where you played at least two."
        empty={insights.aheadOfCrowd.length === 0}
      >
        {insights.aheadOfCrowd.map((game) => (
          <GameRow key={game.appId} game={game} detail={crowdDetail(game)} />
        ))}
      </ShortList>
    </section>
  );
}

// --- Résumés LLM -------------------------------------------------------------

export function LibrarySummaries({
  games,
  byPlaytime,
}: {
  games: { game: LibraryGame; summary: GameReviewSummary }[];
  /** `false` quand le temps de jeu est caché : les jeux sont alors les plus commentés. */
  byPlaytime: boolean;
}) {
  if (games.length === 0) return null;

  return (
    <section className="mt-10">
      <SectionHead
        title="What players say about your games"
        note={
          <span className="flex items-center gap-1.5">
            AI summaries of the reviews, for your {byPlaytime ? "most played" : "most reviewed"} games
            <InfoHint text="Written by an open language model run by steam.reviews, from the most helpful and a few of the funniest reviews on each side. Only games with enough reviews both ways get one. It can get things wrong." />
          </span>
        }
      />
      <div className="space-y-3">
        {games.map(({ game, summary }) => (
          <details key={game.appId} className="group rounded-md border border-[#1e2b36] bg-[#0a0f14] p-4">
            <summary className="flex cursor-pointer list-none items-center gap-3">
              <GameThumb game={game} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-[#eef2f4]">{game.name}</span>
                <span className="mt-1 line-clamp-2 block text-sm text-[#9fb2bd] group-open:line-clamp-none">
                  {summary.summary}
                </span>
              </span>
              <span aria-hidden className="shrink-0 font-mono text-[#7d919c] group-open:rotate-90">
                ›
              </span>
            </summary>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <PointList tone="good" title="Pros" points={summary.pros} />
              <PointList tone="critical" title="Cons" points={summary.cons} />
            </div>
            <Link href={`/games/${game.appId}`} className="mt-3 inline-block text-sm text-brand-blue hover:underline">
              See the game&apos;s stats →
            </Link>
          </details>
        ))}
      </div>
    </section>
  );
}
