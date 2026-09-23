import { describe, expect, it } from "vitest";
import {
  indexableGamesChunkQuery,
  parseChunk,
  SITEMAP_CHUNK_SIZE,
  SITEMAP_MIN_REVIEWS,
  countIndexableGamesQuery,
  sitemapIndexPaths,
  sitemapIndexXml,
  STATIC_PATHS,
  urlsetXml,
} from "@/lib/sitemap";

describe("sitemapIndexPaths", () => {
  it("annonce les pages fixes puis une tranche par 50 000 jeux", () => {
    expect(sitemapIndexPaths(173_000)).toEqual([
      "/sitemaps/pages.xml",
      "/sitemaps/games/0.xml",
      "/sitemaps/games/1.xml",
      "/sitemaps/games/2.xml",
      "/sitemaps/games/3.xml",
    ]);
  });

  it("garde une tranche de jeux même quand le catalogue est vide", () => {
    expect(sitemapIndexPaths(0)).toEqual(["/sitemaps/pages.xml", "/sitemaps/games/0.xml"]);
  });
});

describe("parseChunk", () => {
  it("lit le numéro de tranche et refuse le reste", () => {
    expect(parseChunk("3.xml")).toBe(3);
    expect(parseChunk("3")).toBeNull();
    expect(parseChunk("-1.xml")).toBeNull();
    expect(parseChunk("abc.xml")).toBeNull();
  });
});

describe("indexableGamesChunkQuery", () => {
  it("découpe le catalogue en tranches stables, triées par app id", () => {
    const { text, values } = indexableGamesChunkQuery(2);
    expect(text).toMatch(/ORDER BY steam_app_id/);
    expect(values).toEqual([SITEMAP_MIN_REVIEWS, SITEMAP_CHUNK_SIZE, 2 * SITEMAP_CHUNK_SIZE]);
  });

  it("applique le même plancher d'avis au comptage et aux tranches", () => {
    expect(countIndexableGamesQuery().text).toMatch(/total_reviews >= \$1/);
    expect(countIndexableGamesQuery().values).toEqual([SITEMAP_MIN_REVIEWS]);
    expect(indexableGamesChunkQuery(0).text).toMatch(/total_reviews >= \$1/);
  });
});

describe("XML", () => {
  it("écrit des URL absolues et échappe les esperluettes", () => {
    const xml = urlsetXml(["/games/1086940", "/charts?filter=best-rated&page=2"]);
    expect(xml).toContain("<loc>https://steam.reviews/games/1086940</loc>");
    expect(xml).toContain("<loc>https://steam.reviews/charts?filter=best-rated&amp;page=2</loc>");
  });

  it("référence chaque sitemap dans l'index", () => {
    const xml = sitemapIndexXml(["/sitemaps/pages.xml"]);
    expect(xml).toContain("<sitemapindex");
    expect(xml).toContain("<sitemap><loc>https://steam.reviews/sitemaps/pages.xml</loc></sitemap>");
  });

  it("liste la home et chaque classement de /charts", () => {
    expect(STATIC_PATHS).toContain("/");
    expect(STATIC_PATHS).toContain("/charts");
    expect(STATIC_PATHS).toContain("/charts?filter=best-rated");
    expect(STATIC_PATHS).not.toContain("/charts?filter=most-reviewed");
  });
});
