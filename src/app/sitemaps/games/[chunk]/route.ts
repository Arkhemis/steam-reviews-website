import { getIndexableGameIds, parseChunk, urlsetXml, xmlResponse } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ chunk: string }> }) {
  const chunk = parseChunk((await params).chunk);
  if (chunk === null) return new Response("Not found", { status: 404 });

  const ids = await getIndexableGameIds(chunk);
  // Une tranche au-delà du catalogue n'existe pas : un urlset vide serait
  // signalé en erreur dans la Search Console.
  if (ids.length === 0) return new Response("Not found", { status: 404 });

  return xmlResponse(urlsetXml(ids.map((id) => `/games/${id}`)));
}
