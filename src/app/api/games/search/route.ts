import { getTopGames } from "@/lib/data/gameData";
import { MAX_SEARCH_RESULTS, MIN_QUERY_LENGTH, type GameSearchHit } from "@/lib/gameSearch";

// Typeahead endpoint behind the map's game filter. Reads Postgres on every
// call, so it must never be prerendered (see carte/page.tsx).
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (query.length < MIN_QUERY_LENGTH) {
    return Response.json({ games: [] });
  }

  const games = await getTopGames(MAX_SEARCH_RESULTS, query);

  return Response.json({
    games: games.map(
      (game): GameSearchHit => ({
        appId: game.appId,
        name: game.name,
        coverUrl: game.coverUrl,
        totalReviews: game.totalReviews,
        pctPositive: game.pctPositive,
      }),
    ),
  });
}
