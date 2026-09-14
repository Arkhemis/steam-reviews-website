// Le mart ne porte qu'une jaquette IGDB au format 2:3 : de quoi faire une
// vignette, pas le fond d'un bandeau trois fois plus large que haut. Steam,
// lui, sert une illustration panoramique (1920 x 620) — celle qu'on voit
// derrière un jeu dans la bibliothèque — à une URL qui se déduit du seul
// `app_id`, sans clé ni appel d'API. C'est la seule image large dont on
// dispose pour le héros de la home.
//
// On vise `cdn.cloudflare.steamstatic.com` plutôt que `shared.steamstatic.com`
// : le second répond par un 301 que l'optimiseur d'images de Next devrait
// suivre vers un hôte absent de `remotePatterns`.
const STEAM_ASSETS = "https://cdn.cloudflare.steamstatic.com/steam/apps";

// Steam met plusieurs secondes à répondre de temps en temps, et le héros n'a
// pas à retenir la page pour une image de fond : au-delà, on rend sans.
const PROBE_TIMEOUT_MS = 2500;

export function steamHeroArtUrl(appId: number): string {
  return `${STEAM_ASSETS}/${appId}/library_hero.jpg`;
}

/**
 * L'illustration panoramique du jeu, ou `null` quand Steam n'en a pas — tous
 * les jeux n'en publient pas, et un 404 servi à `next/image` rendrait un
 * bandeau vide. L'appelant retombe alors sur la jaquette.
 */
export async function resolveSteamHeroArt(appId: number): Promise<string | null> {
  const url = steamHeroArtUrl(appId);

  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return response.ok ? url : null;
  } catch {
    return null;
  }
}
