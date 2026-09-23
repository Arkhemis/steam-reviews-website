import { CHART_FILTERS, chartsHref } from "@/lib/charts";
import { pool } from "@/lib/db";
import { SITE_URL } from "@/lib/site";

// Le plafond du protocole sitemap (et de Google) : 50 000 URL par fichier.
export const SITEMAP_CHUNK_SIZE = 50_000;

// Les pages hors fiches de jeu. Chaque classement de `/charts` a sa propre
// adresse (`chartsHref` n'écrit que le tri par défaut sans query string) :
// Google ne les atteindrait sinon que par la barre de filtres.
export const STATIC_PATHS = [
  "/",
  "/games",
  ...CHART_FILTERS.map((filter) => chartsHref({ filter: filter.key })),
  "/map",
  "/battle",
];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function urlsetXml(paths: string[]): string {
  const urls = paths.map((path) => `<url><loc>${escapeXml(`${SITE_URL}${path}`)}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function sitemapIndexXml(paths: string[]): string {
  const sitemaps = paths
    .map((path) => `<sitemap><loc>${escapeXml(`${SITE_URL}${path}`)}</loc></sitemap>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemaps}\n</sitemapindex>\n`;
}

/**
 * Les fichiers que l'index annonce : les pages fixes, puis un fichier par
 * tranche de jeux. Sans jeu, aucune tranche : la route d'une tranche vide
 * répond 404, que la Search Console signalerait.
 */
export function sitemapIndexPaths(totalGames: number): string[] {
  const chunks = Math.ceil(totalGames / SITEMAP_CHUNK_SIZE);
  return ["/sitemaps/pages.xml", ...Array.from({ length: chunks }, (_, i) => `/sitemaps/games/${i}.xml`)];
}

/**
 * `"3.xml"` → `3` ; tout autre segment → `null`, que la route traduit en 404.
 * Un numéro dont l'OFFSET ne tient pas dans un entier sûr ferait échouer la
 * requête : il est refusé au même titre.
 */
export function parseChunk(segment: string): number | null {
  const match = /^(\d+)\.xml$/.exec(segment);
  if (!match) return null;
  const chunk = Number(match[1]);
  return Number.isSafeInteger(chunk) && Number.isSafeInteger(chunk * SITEMAP_CHUNK_SIZE) ? chunk : null;
}

// Une fiche à un seul avis n'a presque rien à montrer à un moteur de
// recherche. Le plancher est le plus haut qui garde au moins 90 % des jeux
// commentés : en prod (septembre 2026), 2 avis en gardent 94,5 %, 3 avis
// 89,96 %. Un même `steam_app_id` peut porter plusieurs fiches IGDB, d'où le
// DISTINCT.
export const SITEMAP_MIN_REVIEWS = 2;

const INDEXABLE_GAMES = `FROM marts.game_stats WHERE total_reviews >= $1`;

export function countIndexableGamesQuery(): { text: string; values: unknown[] } {
  return { text: `SELECT COUNT(DISTINCT steam_app_id) AS total ${INDEXABLE_GAMES}`, values: [SITEMAP_MIN_REVIEWS] };
}

export function indexableGamesChunkQuery(chunk: number): { text: string; values: unknown[] } {
  return {
    text: `SELECT DISTINCT steam_app_id ${INDEXABLE_GAMES} ORDER BY steam_app_id LIMIT $2 OFFSET $3`,
    values: [SITEMAP_MIN_REVIEWS, SITEMAP_CHUNK_SIZE, chunk * SITEMAP_CHUNK_SIZE],
  };
}

export async function countIndexableGames(): Promise<number> {
  const { text, values } = countIndexableGamesQuery();
  const { rows } = await pool.query<{ total: string }>(text, values);
  return Number(rows[0]?.total ?? 0);
}

export async function getIndexableGameIds(chunk: number): Promise<number[]> {
  const { text, values } = indexableGamesChunkQuery(chunk);
  const { rows } = await pool.query<{ steam_app_id: string }>(text, values);
  return rows.map((row) => Number(row.steam_app_id));
}

// Le catalogue ne bouge qu'au rythme du pipeline : Googlebot peut garder le
// fichier une heure, Caddy ne cache rien de lui-même.
export function xmlResponse(body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
