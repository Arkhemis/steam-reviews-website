import { describe, expect, it, vi } from "vitest";
import { CALLBACK_PATH, STEAM_OPENID_ENDPOINT, steamLoginUrl, verifySteamAssertion } from "@/lib/auth/steamOpenId";

const ORIGIN = "https://steam.reviews";
const ID = "76561197960287930";
const NOW = Date.parse("2026-09-25T10:00:30Z");

function assertion(overrides: Record<string, string> = {}): URLSearchParams {
  const claimed = `https://steamcommunity.com/openid/id/${ID}`;
  return new URLSearchParams({
    state: "abc",
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "id_res",
    "openid.op_endpoint": STEAM_OPENID_ENDPOINT,
    "openid.claimed_id": claimed,
    "openid.identity": claimed,
    "openid.return_to": `${ORIGIN}${CALLBACK_PATH}?state=abc`,
    "openid.response_nonce": "2026-09-25T10:00:00ZxYz123",
    "openid.assoc_handle": "1234567890",
    "openid.signed": "signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle",
    "openid.sig": "c2lnbmF0dXJl",
    ...overrides,
  });
}

function steamAnswering(body: string) {
  return vi.fn(async () => new Response(body)) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

describe("steamLoginUrl", () => {
  it("renvoie vers Steam avec notre realm et un retour qui porte l'état", () => {
    const url = new URL(steamLoginUrl(ORIGIN, "abc"));
    expect(`${url.origin}${url.pathname}`).toBe(STEAM_OPENID_ENDPOINT);
    expect(url.searchParams.get("openid.mode")).toBe("checkid_setup");
    expect(url.searchParams.get("openid.realm")).toBe(ORIGIN);
    expect(url.searchParams.get("openid.return_to")).toBe(`${ORIGIN}${CALLBACK_PATH}?state=abc`);
  });
});

describe("verifySteamAssertion", () => {
  it("rend le SteamID quand Steam confirme l'assertion", async () => {
    const fetchImpl = steamAnswering("ns:http://specs.openid.net/auth/2.0\nis_valid:true\n");
    expect(await verifySteamAssertion(assertion(), ORIGIN, { fetchImpl, now: NOW })).toBe(ID);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(STEAM_OPENID_ENDPOINT);
    const body = init.body as URLSearchParams;
    expect(body.get("openid.mode")).toBe("check_authentication");
    expect(body.get("openid.sig")).toBe("c2lnbmF0dXJl");
    // Seuls les paramètres OpenID repartent chez Steam.
    expect(body.has("state")).toBe(false);
  });

  // La faille de la version Plish : un `claimed_id` écrit à la main passait.
  it("refuse une assertion que Steam ne confirme pas", async () => {
    const fetchImpl = steamAnswering("ns:http://specs.openid.net/auth/2.0\nis_valid:false\n");
    expect(await verifySteamAssertion(assertion(), ORIGIN, { fetchImpl, now: NOW })).toBeNull();
  });

  it("refuse sans même appeler Steam quand l'assertion ne tient pas debout", async () => {
    const fetchImpl = steamAnswering("is_valid:true\n");
    const cases: Record<string, string>[] = [
      { "openid.mode": "cancel" },
      { "openid.op_endpoint": "https://evil.example/openid/login" },
      { "openid.return_to": `https://evil.example${CALLBACK_PATH}` },
      { "openid.return_to": `${ORIGIN}/elsewhere` },
      { "openid.claimed_id": "https://evil.example/openid/id/76561197960287930" },
      { "openid.identity": "https://steamcommunity.com/openid/id/76561197960287931" },
      { "openid.response_nonce": "2026-09-25T09:00:00Zold" },
      { "openid.response_nonce": "garbage" },
    ];
    for (const overrides of cases) {
      expect(await verifySteamAssertion(assertion(overrides), ORIGIN, { fetchImpl, now: NOW })).toBeNull();
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuse quand Steam ne répond pas", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("timeout");
    }) as unknown as typeof fetch;
    expect(await verifySteamAssertion(assertion(), ORIGIN, { fetchImpl, now: NOW })).toBeNull();
  });
});
