import { cookies } from "next/headers";
import { readSessionToken, SESSION_COOKIE, sessionSecret } from "@/lib/auth/session";
import { SITE_URL } from "@/lib/site";

/** Le SteamID du lecteur connecté, ou `null`. Rend la page dynamique. */
export async function getSessionSteamId(): Promise<string | null> {
  const secret = sessionSecret();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!secret || !token) return null;
  return readSessionToken(token, secret);
}

// L'origine que Steam doit voir en `realm` et vers laquelle on redirige. En
// prod, la requête arrive de Caddy sous `0.0.0.0:3000` et ne dit pas sous quel
// nom on est servi ; en dev, c'est elle qui a raison (`localhost:3000`).
export function authOrigin(request: Request): string {
  if (process.env.AUTH_ORIGIN) return process.env.AUTH_ORIGIN;
  return process.env.NODE_ENV === "production" ? SITE_URL : new URL(request.url).origin;
}
