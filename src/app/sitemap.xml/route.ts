import { countIndexableGames, sitemapIndexPaths, sitemapIndexXml, xmlResponse } from "@/lib/sitemap";

// Un index écrit à la main plutôt que `generateSitemaps` : ce dernier compte
// les tranches au build, où la base n'est pas joignable.
export const dynamic = "force-dynamic";

export async function GET() {
  return xmlResponse(sitemapIndexXml(sitemapIndexPaths(await countIndexableGames())));
}
