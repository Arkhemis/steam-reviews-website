import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveSteamHeroArt } from "@/lib/steamArtwork";

// Réponse de `IStoreBrowseService/GetItems`, réduite à ce que le résolveur lit.
function storeItems(assets: Record<string, string> | undefined) {
  return new Response(JSON.stringify({ response: { store_items: [{ appid: 1, assets }] } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveSteamHeroArt", () => {
  it("suit le chemin haché que Steam donne aux jeux récents", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        storeItems({
          asset_url_format: "steam/apps/4892010/${FILENAME}?t=1787954440",
          library_hero: "ac36fb0d21d910fa7dc4b9ac39cfcf86d0d1ec48/library_hero.jpg",
        }),
      ),
    );

    await expect(resolveSteamHeroArt(4892010)).resolves.toBe(
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/4892010/ac36fb0d21d910fa7dc4b9ac39cfcf86d0d1ec48/library_hero.jpg?t=1787954440",
    );
  });

  it("sert aussi les jeux plus anciens, dont l'illustration n'est pas hachée", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        storeItems({ asset_url_format: "steam/apps/444940/${FILENAME}?t=1699491285", library_hero: "library_hero.jpg" }),
      ),
    );

    await expect(resolveSteamHeroArt(444940)).resolves.toBe(
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/444940/library_hero.jpg?t=1699491285",
    );
  });

  it("rend null quand le jeu n'a pas d'illustration panoramique", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(storeItems({ asset_url_format: "steam/apps/1/${FILENAME}", header: "header.jpg" })),
    );

    await expect(resolveSteamHeroArt(1)).resolves.toBeNull();
  });

  it("rend null quand Steam ne connaît pas le jeu", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(storeItems(undefined)));

    await expect(resolveSteamHeroArt(1)).resolves.toBeNull();
  });

  it("rend null quand l'API répond en erreur ou ne répond pas", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    await expect(resolveSteamHeroArt(1)).resolves.toBeNull();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    await expect(resolveSteamHeroArt(1)).resolves.toBeNull();
  });
});
