import { NextResponse } from "next/server";
import { authOrigin } from "@/lib/auth/currentUser";
import { resolveVanityUrl, SteamApiError } from "@/lib/steamApi";
import { parseProfileInput } from "@/lib/steamProfile";

export const dynamic = "force-dynamic";

// La cible du champ « Steam ID or profile URL ». Résolue ici plutôt que dans la
// page : une page streamée ne redirige que par une balise meta, après avoir
// montré son squelette ; une route handler répond un vrai 307.
async function resolve(input: string): Promise<{ steamId: string } | { error: string }> {
  const ref = parseProfileInput(input);
  if (!ref) return { error: "invalid" };
  if (ref.kind === "steamId") return { steamId: ref.steamId };
  try {
    const steamId = await resolveVanityUrl(ref.vanity);
    return steamId ? { steamId } : { error: "not-found" };
  } catch (error) {
    if (error instanceof SteamApiError) return { error: "steam-unavailable" };
    throw error;
  }
}

export async function GET(request: Request): Promise<Response> {
  const origin = authOrigin(request);
  const input = new URL(request.url).searchParams.get("profile") ?? "";
  const resolved = await resolve(input);

  if ("steamId" in resolved) return NextResponse.redirect(new URL(`/library/${resolved.steamId}`, origin));

  const back = new URL("/library", origin);
  back.searchParams.set("error", resolved.error);
  back.searchParams.set("profile", input);
  return NextResponse.redirect(back);
}
