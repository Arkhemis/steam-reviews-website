// Le mart ne porte qu'une jaquette IGDB au format 2:3 : de quoi faire une
// vignette, pas le fond d'un bandeau trois fois plus large que haut. Steam,
// lui, sert une illustration panoramique (1920 x 620) — celle qu'on voit
// derrière un jeu dans la bibliothèque. C'est la seule image large dont on
// dispose pour les héros.
//
// Son URL ne se déduit plus du seul `app_id` : depuis 2024, Steam range les
// images des jeux récents sous un chemin haché, un hash par image
// (`steam/apps/4892010/ac36fb…/library_hero.jpg`), et l'ancien chemin
// `steam/apps/{id}/library_hero.jpg` leur répond 404. Or ce sont justement les
// jeux récents que les récompenses de la semaine font remonter. On demande
// donc le chemin à `IStoreBrowseService/GetItems` — public, sans clé — qui le
// donne pour les anciens comme pour les récents.
const STORE_ITEMS_API = "https://api.steampowered.com/IStoreBrowseService/GetItems/v1/";

// Le seul hôte qui sert `store_item_assets` sans redirection : les variantes
// Cloudflare répondent 301 vers `shared.steamstatic.com`, que l'optimiseur
// d'images de Next devrait suivre vers un hôte absent de `remotePatterns`.
const STEAM_ASSETS = "https://shared.akamai.steamstatic.com/store_item_assets";

// Steam met plusieurs secondes à répondre de temps en temps, et le héros n'a
// pas à retenir la page pour une image de fond : au-delà, on rend sans.
const PROBE_TIMEOUT_MS = 2500;

type StoreItemsResponse = {
  response?: {
    store_items?: {
      assets?: {
        /** Gabarit du chemin, e.g. `steam/apps/4892010/${FILENAME}?t=1787954440`. */
        asset_url_format?: string;
        /** Nom de fichier, préfixé de son hash quand Steam en donne un. */
        library_hero?: string;
      };
    }[];
  };
};

function storeItemsUrl(appId: number): string {
  const input = {
    ids: [{ appid: appId }],
    context: { language: "english", country_code: "US" },
    data_request: { include_assets: true },
  };
  return `${STORE_ITEMS_API}?input_json=${encodeURIComponent(JSON.stringify(input))}`;
}

/**
 * L'illustration panoramique du jeu, ou `null` quand Steam n'en a pas — tous
 * les jeux n'en publient pas — ou ne répond pas à temps. L'appelant retombe
 * alors sur la jaquette.
 */
export async function resolveSteamHeroArt(appId: number): Promise<string | null> {
  try {
    const response = await fetch(storeItemsUrl(appId), { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    if (!response.ok) return null;

    const body = (await response.json()) as StoreItemsResponse;
    const assets = body.response?.store_items?.[0]?.assets;
    if (!assets?.asset_url_format || !assets.library_hero) return null;

    return `${STEAM_ASSETS}/${assets.asset_url_format.replace("${FILENAME}", assets.library_hero)}`;
  } catch {
    return null;
  }
}
