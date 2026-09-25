// Les trois appels à la Steam Web API qu'il faut pour montrer la bibliothèque
// d'un compte. Ils demandent une clé (`STEAM_API_KEY`), qui voyage dans l'URL :
// ce module ne doit tourner que côté serveur.

const API = "https://api.steampowered.com";

// Une bibliothèque change à chaque session de jeu, pas à chaque seconde, et la
// clé est limitée à 100 000 appels par jour : dix minutes de cache suffisent.
const REVALIDATE_SECONDS = 600;
const TIMEOUT_MS = 8000;

export class SteamApiError extends Error {}

export type SteamPlayer = {
  steamId: string;
  name: string;
  avatarUrl: string;
  profileUrl: string;
  /** `false` quand le profil lui-même est privé ou en « friends only ». */
  isPublic: boolean;
};

export type OwnedGame = {
  appId: number;
  name: string;
  playtimeMinutes: number;
  playtime2WeeksMinutes: number;
  /** `null` pour un jeu jamais lancé. */
  lastPlayedAt: string | null;
};

async function call(path: string, params: Record<string, string>): Promise<unknown> {
  const key = process.env.STEAM_API_KEY;
  if (!key) throw new SteamApiError("STEAM_API_KEY is not set");

  const url = `${API}${path}?${new URLSearchParams({ key, format: "json", ...params })}`;
  let response: Response;
  try {
    response = await fetch(url, {
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new SteamApiError(`Steam API ${path} unreachable: ${(error as Error).message}`);
  }
  if (!response.ok) throw new SteamApiError(`Steam API ${path} answered ${response.status}`);
  return response.json();
}

type PlayerSummariesJson = {
  response?: {
    players?: {
      steamid: string;
      personaname: string;
      avatarfull: string;
      profileurl: string;
      communityvisibilitystate: number;
    }[];
  };
};

export function parsePlayerSummary(json: unknown): SteamPlayer | null {
  const player = (json as PlayerSummariesJson).response?.players?.[0];
  if (!player) return null;
  return {
    steamId: player.steamid,
    name: player.personaname,
    avatarUrl: player.avatarfull,
    profileUrl: player.profileurl,
    // 3 = public ; 1 = privé ou « friends only », sans distinction pour nous.
    isPublic: player.communityvisibilitystate === 3,
  };
}

type OwnedGamesJson = {
  response?: {
    game_count?: number;
    games?: {
      appid: number;
      name?: string;
      playtime_forever?: number;
      playtime_2weeks?: number;
      rtime_last_played?: number;
    }[];
  };
};

/**
 * Les jeux du compte, ou `null` quand Steam ne les montre pas. Un profil public
 * peut garder ses « game details » privés : Steam répond alors `{}`, sans
 * erreur, là où une bibliothèque vide porte `game_count: 0`.
 */
export function parseOwnedGames(json: unknown): OwnedGame[] | null {
  const response = (json as OwnedGamesJson).response;
  if (!response || response.game_count === undefined) return null;
  return (response.games ?? []).map((game) => ({
    appId: game.appid,
    name: game.name ?? `App ${game.appid}`,
    playtimeMinutes: game.playtime_forever ?? 0,
    playtime2WeeksMinutes: game.playtime_2weeks ?? 0,
    lastPlayedAt: game.rtime_last_played ? new Date(game.rtime_last_played * 1000).toISOString() : null,
  }));
}

type ResolveVanityJson = { response?: { success?: number; steamid?: string } };

export function parseResolvedVanity(json: unknown): string | null {
  const response = (json as ResolveVanityJson).response;
  return response?.success === 1 && response.steamid ? response.steamid : null;
}

export async function getPlayerSummary(steamId: string): Promise<SteamPlayer | null> {
  return parsePlayerSummary(await call("/ISteamUser/GetPlayerSummaries/v2/", { steamids: steamId }));
}

export async function getOwnedGames(steamId: string): Promise<OwnedGame[] | null> {
  return parseOwnedGames(
    await call("/IPlayerService/GetOwnedGames/v1/", {
      steamid: steamId,
      include_appinfo: "1",
      include_played_free_games: "1",
    }),
  );
}

/** Le SteamID64 derrière une URL personnalisée, ou `null` si elle n'existe pas. */
export async function resolveVanityUrl(vanity: string): Promise<string | null> {
  return parseResolvedVanity(await call("/ISteamUser/ResolveVanityURL/v1/", { vanityurl: vanity }));
}
