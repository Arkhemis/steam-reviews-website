// Ce que le lecteur colle dans le champ « Steam ID or profile URL » : un
// SteamID64, l'URL de son profil, ou son URL personnalisée — nue ou complète.
// Seul le SteamID64 se lit tel quel ; une URL personnalisée doit passer par
// `ResolveVanityURL` avant qu'on puisse demander la bibliothèque.

export type SteamProfileRef = { kind: "steamId"; steamId: string } | { kind: "vanity"; vanity: string };

// Les comptes individuels : l'univers public (1) et le type « individual » (1)
// fixent le préfixe, les 32 bits du compte font le reste — 17 chiffres en tout.
const STEAM_ID64 = /^7656119\d{10}$/;

// Steam accepte lettres, chiffres, `_` et `-` dans une URL personnalisée, de 2
// à 32 caractères.
const VANITY = /^[A-Za-z0-9_-]{2,32}$/;

const PROFILE_URL = /^(?:https?:\/\/)?(?:www\.)?steamcommunity\.com\/(profiles|id)\/([^/?#]+)\/?(?:[?#].*)?$/i;

export function isSteamId64(value: string): boolean {
  return STEAM_ID64.test(value);
}

export function parseProfileInput(input: string): SteamProfileRef | null {
  const value = input.trim();
  if (!value) return null;

  const url = PROFILE_URL.exec(value);
  if (url) {
    const [, kind, segment] = url;
    if (kind.toLowerCase() === "profiles") {
      return isSteamId64(segment) ? { kind: "steamId", steamId: segment } : null;
    }
    return VANITY.test(segment) ? { kind: "vanity", vanity: segment } : null;
  }

  if (isSteamId64(value)) return { kind: "steamId", steamId: value };
  // Un nombre qui n'est pas un SteamID64 est sans doute une faute de frappe :
  // le traiter en URL personnalisée renverrait un « introuvable » trompeur.
  if (/^\d+$/.test(value)) return null;
  return VANITY.test(value) ? { kind: "vanity", vanity: value } : null;
}
