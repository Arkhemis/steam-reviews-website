import { NextResponse } from "next/server";
import { authOrigin } from "@/lib/auth/currentUser";
import { SESSION_COOKIE } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// En POST seulement : un simple lien vers une déconnexion en GET se ferait
// suivre par n'importe quelle image posée sur un autre site.
export async function POST(request: Request): Promise<Response> {
  // 303 pour que le navigateur revienne en GET sur la page d'accueil de la
  // bibliothèque, et pas en POST.
  const response = NextResponse.redirect(new URL("/library", authOrigin(request)), 303);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
