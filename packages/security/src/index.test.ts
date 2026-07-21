import { describe, expect, it, vi } from "vitest";
import { DurableStore } from "@agripay/storage";
import {
  hashPassword,
  OperatorAuth,
  parseCookies,
  securityHeaders,
  verifyPassword,
} from "./index.js";
async function setup(overrides: Partial<ConstructorParameters<typeof OperatorAuth>[1]> = {}) {
  const store = new DurableStore(":memory:"),
    passwordHash = await hashPassword("a-strong-demo-passphrase");
  const auth = new OperatorAuth(store, {
    secret: "0123456789abcdef0123456789abcdef",
    idleTtlSeconds: 300,
    absoluteTtlSeconds: 900,
    secureCookies: false,
    passwordHash,
    ...overrides,
  });
  return { store, auth };
}
describe("operator authentication", () => {
  it("hashes and verifies without plaintext", async () => {
    const hash = await hashPassword("a-strong-demo-passphrase");
    expect(hash).not.toContain("a-strong-demo-passphrase");
    expect(await verifyPassword("a-strong-demo-passphrase", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
  it("uses generic failure and throttles repeated login attempts", async () => {
    const { store, auth } = await setup();
    for (let i = 0; i < 5; i++)
      expect(await auth.login("wrong", "source")).toEqual({ ok: false, limited: false });
    expect(await auth.login("wrong", "source")).toEqual({ ok: false, limited: true });
    store.close();
  });
  it("creates random server-side session and session-bound CSRF", async () => {
    const { store, auth } = await setup();
    const login = await auth.login("a-strong-demo-passphrase", "source");
    if (!login.ok) throw new Error("login failed");
    const session = auth.authenticate(login.setCookie);
    if (!session) throw new Error("session missing");
    expect(auth.validateCsrf(session, login.csrfToken)).toBe(true);
    expect(auth.validateCsrf(session, "wrong")).toBe(false);
    store.close();
  });
  it("rejects cross-session CSRF and revokes logout", async () => {
    const { store, auth } = await setup();
    const a = await auth.login("a-strong-demo-passphrase", "a"),
      b = await auth.login("a-strong-demo-passphrase", "b");
    if (!a.ok || !b.ok) throw new Error("login failed");
    const session = auth.authenticate(a.setCookie);
    if (!session) throw new Error("session missing");
    expect(auth.validateCsrf(session, b.csrfToken)).toBe(false);
    auth.logout(session);
    expect(auth.authenticate(a.setCookie)).toBeUndefined();
    store.close();
  });
  it("expires idle sessions", async () => {
    vi.useFakeTimers();
    const { store, auth } = await setup({ idleTtlSeconds: 1 });
    const login = await auth.login("a-strong-demo-passphrase", "source");
    if (!login.ok) throw new Error("login failed");
    vi.advanceTimersByTime(1100);
    expect(auth.authenticate(login.setCookie)).toBeUndefined();
    vi.useRealTimers();
    store.close();
  });
  it("sets Secure, HttpOnly and SameSite in production", async () => {
    const { store, auth } = await setup({ secureCookies: true });
    const login = await auth.login("a-strong-demo-passphrase", "source");
    if (!login.ok) throw new Error("login failed");
    expect(login.setCookie).toContain("Secure");
    expect(login.setCookie).toContain("HttpOnly");
    expect(login.setCookie).toContain("SameSite=Strict");
    store.close();
  });
  it("supports explicitly hardened cross-site cookies", async () => {
    const { store, auth } = await setup({ secureCookies: true, sameSite: "None" });
    const challenge = auth.issueLoginCsrf();
    expect(challenge.setCookie).toContain("SameSite=None");
    expect(challenge.setCookie).toContain("Secure");
    store.close();
  });
});
describe("CSRF and headers", () => {
  it("accepts a current matching login challenge", async () => {
    const { store, auth } = await setup();
    const challenge = auth.issueLoginCsrf();
    expect(auth.validateLoginCsrf(challenge.token, challenge.setCookie)).toBe(true);
    expect(auth.validateLoginCsrf("wrong", challenge.setCookie)).toBe(false);
    expect(auth.validateLoginCsrf(challenge.token, undefined)).toBe(false);
    store.close();
  });
  it("does not add HSTS outside confirmed production HTTPS", () => {
    expect(securityHeaders({ production: false, https: false })).not.toHaveProperty(
      "strict-transport-security",
    );
    expect(securityHeaders({ production: true, https: true })).toHaveProperty(
      "strict-transport-security",
    );
  });
  it("sets strict CSP and browser protections", () => {
    const headers = securityHeaders({ production: true, https: true });
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers).toMatchObject({
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    });
  });
  it("parses cookies without decoding unsafe state", () => {
    expect(parseCookies("a=1; b=2")).toEqual({ a: "1", b: "2" });
  });
});
