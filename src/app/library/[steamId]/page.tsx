import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LibraryLookupForm } from "@/components/LibraryLookupForm";
import { Nav } from "@/components/Nav";
import { getSessionSteamId } from "@/lib/auth/currentUser";
import { getGameReviewSummaries, getGameStatsByAppIds } from "@/lib/data/gameData";
import { buildLibrary, libraryInsights } from "@/lib/library";
import { getOwnedGames, getPlayerSummary, SteamApiError } from "@/lib/steamApi";
import { isSteamId64 } from "@/lib/steamProfile";
import {
  HiddenPlaytimeNotice,
  LibraryKpis,
  LibraryShortLists,
  LibrarySummaries,
  MostPlayed,
  PlayerHeader,
  VerdictBreakdown,
} from "./sections";

// Une bibliothèque est une donnée personnelle, même publique sur Steam : on la
// montre à qui a le lien, on ne la donne pas aux moteurs.
export const metadata: Metadata = {
  title: "Steam library",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Les résumés sont cherchés parmi les jeux les plus joués : au-delà, un jeu
// lancé dix minutes ne mérite pas qu'on en résume les avis.
const SUMMARY_CANDIDATES = 30;
const SUMMARIES_SHOWN = 6;

type LibraryProfilePageProps = {
  params: Promise<{ steamId: string }>;
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-7">
        <Nav active="library" />
        {children}
      </div>
    </div>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8 max-w-xl rounded-md border border-[#1e2b36] bg-[#0a0f14] p-5">
      <h2 className="m-0 text-lg font-extrabold tracking-tight">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed text-[#9fb2bd]">{children}</div>
    </div>
  );
}

export default async function LibraryProfilePage({ params }: LibraryProfilePageProps) {
  const { steamId } = await params;
  if (!isSteamId64(steamId)) notFound();

  let player, owned;
  try {
    [player, owned] = await Promise.all([getPlayerSummary(steamId), getOwnedGames(steamId)]);
  } catch (error) {
    if (!(error instanceof SteamApiError)) throw error;
    return (
      <Shell>
        <Notice title="Steam didn't answer">
          We couldn&apos;t reach Steam to read this library. Please try again in a minute.
        </Notice>
      </Shell>
    );
  }
  if (!player) notFound();

  const isOwner = (await getSessionSteamId()) === steamId;

  if (owned === null) {
    return (
      <Shell>
        <PlayerHeader player={player} isOwner={isOwner} />
        <Notice title="This library is private">
          {isOwner ? "Your" : "This profile's"} game details aren&apos;t public, so Steam won&apos;t tell us which
          games {isOwner ? "you own" : "it owns"}.
          {isOwner && (
            <>
              {" "}
              Set <strong className="text-[#eef2f4]">Game details</strong> to Public in{" "}
              <a
                href="https://steamcommunity.com/my/edit/settings"
                target="_blank"
                rel="noreferrer"
                className="text-brand-blue hover:underline"
              >
                your Steam privacy settings
              </a>
              , then reload this page — it can take a few minutes for Steam to catch up.
            </>
          )}
        </Notice>
      </Shell>
    );
  }

  const appIds = owned.map((game) => game.appId);
  const library = buildLibrary(owned, await getGameStatsByAppIds(appIds));
  const insights = libraryInsights(library);

  // Sans temps de jeu, les plus commentés de la bibliothèque prennent la place
  // des plus joués : ce sont eux qui ont le plus de chances d'avoir un résumé.
  const candidates = library
    .filter((game) => game.stats !== null && (insights.playtimeHidden || game.playtimeMinutes > 0))
    .sort((a, b) =>
      insights.playtimeHidden
        ? b.stats!.totalReviews - a.stats!.totalReviews
        : b.playtimeMinutes - a.playtimeMinutes,
    )
    .slice(0, SUMMARY_CANDIDATES);
  const summaries = await getGameReviewSummaries(candidates.map((game) => game.appId));
  const summarized = candidates
    .flatMap((game) => {
      const summary = summaries.get(game.appId);
      return summary ? [{ game, summary }] : [];
    })
    .slice(0, SUMMARIES_SHOWN);

  return (
    <Shell>
      <PlayerHeader player={player} isOwner={isOwner} />

      {insights.gameCount === 0 ? (
        <Notice title="No games yet">Steam lists no games on this account.</Notice>
      ) : (
        <>
          <LibraryKpis insights={insights} />
          {insights.playtimeHidden && <HiddenPlaytimeNotice isOwner={isOwner} />}
          <VerdictBreakdown insights={insights} />
          <MostPlayed games={insights.mostPlayed} />
          <LibrarySummaries games={summarized} byPlaytime={!insights.playtimeHidden} />
          <LibraryShortLists insights={insights} />
        </>
      )}

      <div className="mt-14 max-w-xl">
        <h2 className="m-0 text-sm font-bold text-[#9fb2bd]">Look up another profile</h2>
        <LibraryLookupForm className="mt-2" />
        {!isOwner && (
          <p className="mt-2 text-xs text-[#7d919c]">
            Is this you?{" "}
            <a href="/api/auth/steam/login" className="text-brand-blue hover:underline">
              Sign in through Steam
            </a>
          </p>
        )}
      </div>
    </Shell>
  );
}
