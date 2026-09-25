import { describe, expect, it } from "vitest";
import { isSteamId64, parseProfileInput } from "@/lib/steamProfile";

const ID = "76561197960287930";

describe("parseProfileInput", () => {
  it("lit un SteamID64 nu", () => {
    expect(parseProfileInput(` ${ID} `)).toEqual({ kind: "steamId", steamId: ID });
  });

  it("lit une URL de profil, avec ou sans schéma ni slash final", () => {
    for (const input of [
      `https://steamcommunity.com/profiles/${ID}/`,
      `http://www.steamcommunity.com/profiles/${ID}`,
      `steamcommunity.com/profiles/${ID}/?l=french`,
    ]) {
      expect(parseProfileInput(input)).toEqual({ kind: "steamId", steamId: ID });
    }
  });

  it("lit une URL personnalisée, complète ou nue", () => {
    expect(parseProfileInput("https://steamcommunity.com/id/gabelogannewell/")).toEqual({
      kind: "vanity",
      vanity: "gabelogannewell",
    });
    expect(parseProfileInput("gabelogannewell")).toEqual({ kind: "vanity", vanity: "gabelogannewell" });
  });

  it("refuse le reste", () => {
    expect(parseProfileInput("")).toBeNull();
    expect(parseProfileInput("12345")).toBeNull();
    expect(parseProfileInput("https://steamcommunity.com/profiles/12345")).toBeNull();
    expect(parseProfileInput("https://evil.example/id/gabe")).toBeNull();
    expect(parseProfileInput("not a profile")).toBeNull();
  });
});

describe("isSteamId64", () => {
  it("n'accepte que les 17 chiffres d'un compte individuel", () => {
    expect(isSteamId64(ID)).toBe(true);
    expect(isSteamId64("76561197960287930 ")).toBe(false);
    expect(isSteamId64("1234567890123456")).toBe(false);
  });
});
