import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { authOrigin } from "@/lib/auth/currentUser";
import { cookieOptions, OPENID_STATE_COOKIE, sessionSecret } from "@/lib/auth/session";
import { steamLoginUrl } from "@/lib/auth/steamOpenId";

export const dynamic = "force-dynamic";

// Le jeton d'état lie le retour de Steam au navigateur qui est parti : sans
// lui, un tiers pourrait faire atterrir le lecteur connecté sur son propre
// compte Steam en lui faisant ouvrir une URL de retour déjà signée.
const STATE_MAX_AGE_SECONDS = 10 * 60;

export async function GET(request: Request): Promise<Response> {
  const origin = authOrigin(request);
  if (!sessionSecret()) {
    return NextResponse.redirect(new URL("/library?error=sign-in-unavailable", origin));
  }

  const state = randomBytes(16).toString("base64url");
  const response = NextResponse.redirect(steamLoginUrl(origin, state));
  response.cookies.set(OPENID_STATE_COOKIE, state, cookieOptions(STATE_MAX_AGE_SECONDS));
  return response;
}
