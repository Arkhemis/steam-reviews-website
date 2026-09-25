// La connexion « Sign in through Steam ». Steam n'ouvre pas d'OAuth aux sites
// tiers : il ne parle qu'OpenID 2.0, qui ne rend qu'une chose — le SteamID du
// compte, dans `openid.claimed_id`.
//
// Ce paramètre arrive dans l'URL de retour, donc n'importe qui peut l'écrire à
// la main. On ne le croit qu'après avoir renvoyé toute l'assertion à Steam en
// `check_authentication` et reçu `is_valid:true` : c'est Steam, pas nous, qui
// connaît la clé qui l'a signée.

export const STEAM_OPENID_ENDPOINT = "https://steamcommunity.com/openid/login";

export const CALLBACK_PATH = "/api/auth/steam/callback";

const OPENID_NS = "http://specs.openid.net/auth/2.0";
const IDENTIFIER_SELECT = "http://specs.openid.net/auth/2.0/identifier_select";
const CLAIMED_ID = /^https:\/\/steamcommunity\.com\/openid\/id\/(7656119\d{10})$/;

// Une assertion plus vieille que ça ne sert plus : elle ne peut venir que d'un
// historique ou d'un lien qui a traîné.
const MAX_NONCE_AGE_MS = 5 * 60 * 1000;

const VERIFY_TIMEOUT_MS = 8000;

/** L'URL de Steam où envoyer le lecteur, qui reviendra sur `CALLBACK_PATH`. */
export function steamLoginUrl(origin: string, state: string): string {
  const returnTo = new URL(CALLBACK_PATH, origin);
  returnTo.searchParams.set("state", state);

  const params = new URLSearchParams({
    "openid.ns": OPENID_NS,
    "openid.mode": "checkid_setup",
    "openid.return_to": returnTo.toString(),
    "openid.realm": origin,
    "openid.identity": IDENTIFIER_SELECT,
    "openid.claimed_id": IDENTIFIER_SELECT,
  });
  return `${STEAM_OPENID_ENDPOINT}?${params}`;
}

// `2026-09-25T10:00:00Z` suivi d'un suffixe aléatoire.
function nonceIssuedAt(nonce: string): number | null {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)/.exec(nonce);
  if (!match) return null;
  const time = Date.parse(match[1]);
  return Number.isNaN(time) ? null : time;
}

/**
 * Le SteamID64 que Steam certifie, ou `null` si l'assertion est incomplète,
 * vient d'ailleurs, est périmée ou n'est pas confirmée par Steam.
 */
export async function verifySteamAssertion(
  params: URLSearchParams,
  origin: string,
  { fetchImpl = fetch, now = Date.now() }: { fetchImpl?: typeof fetch; now?: number } = {},
): Promise<string | null> {
  if (params.get("openid.mode") !== "id_res") return null;
  if (params.get("openid.op_endpoint") !== STEAM_OPENID_ENDPOINT) return null;

  // Steam signe `return_to` : il doit pointer chez nous, sans quoi c'est une
  // assertion émise pour un autre site qu'on nous rejoue.
  const returnTo = URL.parse(params.get("openid.return_to") ?? "");
  if (!returnTo || `${returnTo.origin}${returnTo.pathname}` !== new URL(CALLBACK_PATH, origin).toString()) {
    return null;
  }

  const claimedId = params.get("openid.claimed_id") ?? "";
  const match = CLAIMED_ID.exec(claimedId);
  if (!match || params.get("openid.identity") !== claimedId) return null;

  const issuedAt = nonceIssuedAt(params.get("openid.response_nonce") ?? "");
  if (issuedAt === null || Math.abs(now - issuedAt) > MAX_NONCE_AGE_MS) return null;

  const body = new URLSearchParams();
  for (const [key, value] of params) {
    if (key.startsWith("openid.")) body.set(key, value);
  }
  body.set("openid.mode", "check_authentication");

  try {
    const response = await fetchImpl(STEAM_OPENID_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const text = await response.text();
    return text.split("\n").some((line) => line.trim() === "is_valid:true") ? match[1] : null;
  } catch {
    return null;
  }
}
