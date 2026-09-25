import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authOrigin } from "@/lib/auth/currentUser";
import {
  cookieOptions,
  createSessionToken,
  OPENID_STATE_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  sessionSecret,
} from "@/lib/auth/session";
import { verifySteamAssertion } from "@/lib/auth/steamOpenId";

export const dynamic = "force-dynamic";

function sameState(expected: string | undefined, given: string | null): boolean {
  if (!expected || !given || expected.length !== given.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(given));
}

export async function GET(request: Request): Promise<Response> {
  const origin = authOrigin(request);
  const params = new URL(request.url).searchParams;
  const secret = sessionSecret();
  const expectedState = (await cookies()).get(OPENID_STATE_COOKIE)?.value;

  const steamId =
    secret && sameState(expectedState, params.get("state")) ? await verifySteamAssertion(params, origin) : null;

  const response = NextResponse.redirect(
    new URL(steamId ? `/library/${steamId}` : "/library?error=sign-in-failed", origin),
  );
  response.cookies.delete(OPENID_STATE_COOKIE);
  if (steamId && secret) {
    response.cookies.set(SESSION_COOKIE, createSessionToken(steamId, secret), cookieOptions(SESSION_MAX_AGE_SECONDS));
  }
  return response;
}
