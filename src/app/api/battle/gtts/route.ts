import { GOOGLE_TTS_LANG, GOOGLE_TTS_MAX } from "@/lib/tts";

// Relaie la synthèse de Google Traduction (endpoint non documenté, sans clé) :
// une seule voix par langue, en MP3. Hauteur, effets et vitesse sont
// appliqués dans le navigateur (`src/components/duel/voiceFx.ts`).

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const tl = GOOGLE_TTS_LANG[params.get("lang") ?? ""];
  const text = (params.get("text") ?? "").trim();
  if (!tl) return Response.json({ error: "unknown language" }, { status: 400 });
  if (!text || text.length > GOOGLE_TTS_MAX) return Response.json({ error: "bad text" }, { status: 400 });

  const upstream = new URLSearchParams({ ie: "UTF-8", client: "tw-ob", tl, q: text });
  let response: Response;
  try {
    response = await fetch(`https://translate.google.com/translate_tts?${upstream}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return Response.json({ error: "tts unavailable" }, { status: 503 });
  }
  if (!response.ok) return Response.json({ error: `google ${response.status}` }, { status: 502 });
  return new Response(response.body, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
