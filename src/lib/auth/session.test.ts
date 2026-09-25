import { describe, expect, it } from "vitest";
import { createSessionToken, readSessionToken, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session";

const SECRET = "a".repeat(32);
const ID = "76561197960287930";
const NOW = Date.parse("2026-09-25T10:00:00Z");

describe("session", () => {
  it("relit le SteamID d'un jeton qu'elle a signé", () => {
    expect(readSessionToken(createSessionToken(ID, SECRET, NOW), SECRET, NOW)).toBe(ID);
  });

  it("refuse un SteamID réécrit, un autre secret ou un jeton mal formé", () => {
    const token = createSessionToken(ID, SECRET, NOW);
    expect(readSessionToken(token.replace(ID, "76561197960287931"), SECRET, NOW)).toBeNull();
    expect(readSessionToken(token, "b".repeat(32), NOW)).toBeNull();
    expect(readSessionToken(`${token}.extra`, SECRET, NOW)).toBeNull();
    expect(readSessionToken("", SECRET, NOW)).toBeNull();
  });

  it("expire au bout de trente jours", () => {
    const token = createSessionToken(ID, SECRET, NOW);
    expect(readSessionToken(token, SECRET, NOW + (SESSION_MAX_AGE_SECONDS - 1) * 1000)).toBe(ID);
    expect(readSessionToken(token, SECRET, NOW + SESSION_MAX_AGE_SECONDS * 1000)).toBeNull();
  });
});
