import { describe, expect, it } from "vitest";
import { parseOwnedGames, parsePlayerSummary, parseResolvedVanity } from "@/lib/steamApi";

describe("parseOwnedGames", () => {
  it("lit les jeux, le temps de jeu et la dernière session", () => {
    const games = parseOwnedGames({
      response: {
        game_count: 2,
        games: [
          { appid: 620, name: "Portal 2", playtime_forever: 900, playtime_2weeks: 30, rtime_last_played: 1_700_000_000 },
          { appid: 400, name: "Portal", playtime_forever: 0, rtime_last_played: 0 },
        ],
      },
    });
    expect(games).toEqual([
      {
        appId: 620,
        name: "Portal 2",
        playtimeMinutes: 900,
        playtime2WeeksMinutes: 30,
        lastPlayedAt: "2023-11-14T22:13:20.000Z",
      },
      { appId: 400, name: "Portal", playtimeMinutes: 0, playtime2WeeksMinutes: 0, lastPlayedAt: null },
    ]);
  });

  // Steam ne dit pas « privé » : il répond `{}`.
  it("distingue une bibliothèque privée d'une bibliothèque vide", () => {
    expect(parseOwnedGames({ response: {} })).toBeNull();
    expect(parseOwnedGames({})).toBeNull();
    expect(parseOwnedGames({ response: { game_count: 0 } })).toEqual([]);
  });
});

describe("parsePlayerSummary", () => {
  it("lit le profil et sa visibilité", () => {
    const player = {
      steamid: "76561197960287930",
      personaname: "Rabscuttle",
      avatarfull: "https://avatars.steamstatic.com/abc_full.jpg",
      profileurl: "https://steamcommunity.com/id/gabelogannewell/",
      communityvisibilitystate: 3,
    };
    expect(parsePlayerSummary({ response: { players: [player] } })).toEqual({
      steamId: "76561197960287930",
      name: "Rabscuttle",
      avatarUrl: "https://avatars.steamstatic.com/abc_full.jpg",
      profileUrl: "https://steamcommunity.com/id/gabelogannewell/",
      isPublic: true,
    });
    expect(parsePlayerSummary({ response: { players: [{ ...player, communityvisibilitystate: 1 }] } })?.isPublic).toBe(
      false,
    );
  });

  it("rend null pour un compte inconnu", () => {
    expect(parsePlayerSummary({ response: { players: [] } })).toBeNull();
  });
});

describe("parseResolvedVanity", () => {
  it("rend le SteamID seulement quand Steam a trouvé l'URL", () => {
    expect(parseResolvedVanity({ response: { success: 1, steamid: "76561197960287930" } })).toBe("76561197960287930");
    expect(parseResolvedVanity({ response: { success: 42, message: "No match" } })).toBeNull();
  });
});
