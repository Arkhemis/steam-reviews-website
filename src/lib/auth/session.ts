import { createHmac, timingSafeEqual } from "node:crypto";

// La session ne tient qu'un SteamID et une date d'expiration, signés HMAC : pas
// de table d'utilisateurs, rien à stocker côté serveur. Le cookie se lit sans
// base, et un SteamID réécrit à la main casse la signature.

export const SESSION_COOKIE = "sr_session";
export const OPENID_STATE_COOKIE = "sr_openid_state";

export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

// En dessous, un secret se devine plus vite qu'il ne se tape.
const MIN_SECRET_LENGTH = 32;

/** Le secret de signature, ou `null` quand il manque ou est trop court. */
export function sessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(steamId: string, secret: string, now = Date.now()): string {
  const expiresAt = Math.floor(now / 1000) + SESSION_MAX_AGE_SECONDS;
  const payload = `${steamId}.${expiresAt}`;
  return `${payload}.${sign(payload, secret)}`;
}

/** Le SteamID de la session, ou `null` si le jeton est mal formé, falsifié ou expiré. */
export function readSessionToken(token: string, secret: string, now = Date.now()): string | null {
  const [steamId, expiresAt, signature, ...rest] = token.split(".");
  if (!steamId || !expiresAt || !signature || rest.length > 0) return null;

  const expected = Buffer.from(sign(`${steamId}.${expiresAt}`, secret));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  return Number(expiresAt) * 1000 > now ? steamId : null;
}

/** Les options communes aux deux cookies : illisibles en JS, HTTPS en prod. */
export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // `lax` et pas `strict` : le retour de Steam est une navigation venue
    // d'un autre site, et le cookie d'état doit l'accompagner.
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
