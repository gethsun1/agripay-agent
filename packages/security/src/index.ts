import {
  createHash,
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import type { DurableStore } from "@agripay/storage";
const scrypt = (
  password: string,
  salt: Buffer,
  length: number,
  options: Parameters<typeof scryptCallback>[3],
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scryptCallback(password, salt, length, options, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
const HASH_PREFIX = "scrypt-v1";
const SESSION_COOKIE = "agripay_operator";
const LOGIN_CSRF_COOKIE = "agripay_login_csrf";
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
export async function hashPassword(password: string): Promise<string> {
  if (password.length < 16) throw new Error("password_too_short");
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 32, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return `${HASH_PREFIX}$32768$8$1$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  try {
    const [prefix, n, r, p, saltText, hashText] = encoded.split("$");
    if (prefix !== HASH_PREFIX || !n || !r || !p || !saltText || !hashText) return false;
    const expected = Buffer.from(hashText, "base64url");
    const actual = await scrypt(password, Buffer.from(saltText, "base64url"), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024,
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim().split("=", 2))
      .filter((pair): pair is [string, string] => Boolean(pair[0] && pair[1])),
  );
}
const cookie = (name: string, value: string, input: { secure: boolean; maxAge: number }) =>
  `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${String(input.maxAge)}${input.secure ? "; Secure" : ""}`;
export interface SessionConfig {
  secret: string;
  idleTtlSeconds: number;
  absoluteTtlSeconds: number;
  secureCookies: boolean;
  passwordHash: string;
}
export interface OperatorSession {
  sessionHash: string;
  csrfToken: string;
  absoluteExpiresAt: string;
}
export class OperatorAuth {
  constructor(
    readonly store: DurableStore,
    readonly config: SessionConfig,
  ) {
    if (config.secret.length < 32) throw new Error("session_secret_too_short");
  }
  issueLoginCsrf(): { token: string; setCookie: string } {
    const nonce = randomBytes(24).toString("base64url"),
      expires = Date.now() + 300_000,
      payload = `${nonce}.${String(expires)}`,
      signature = createHmac("sha256", this.config.secret).update(payload).digest("base64url"),
      token = `${payload}.${signature}`;
    return {
      token,
      setCookie: cookie(LOGIN_CSRF_COOKIE, token, {
        secure: this.config.secureCookies,
        maxAge: 300,
      }),
    };
  }
  validateLoginCsrf(token: string | undefined, cookieHeader: string | undefined): boolean {
    if (!token) return false;
    const fromCookie = parseCookies(cookieHeader)[LOGIN_CSRF_COOKIE];
    if (!fromCookie || !safeEqual(token, fromCookie)) return false;
    const [nonce, expires, signature] = token.split(".");
    if (!nonce || !expires || !signature || Number(expires) < Date.now()) return false;
    const expected = createHmac("sha256", this.config.secret)
      .update(`${nonce}.${expires}`)
      .digest("base64url");
    return safeEqual(signature, expected);
  }
  async login(
    password: string,
    source: string,
  ): Promise<{ ok: true; csrfToken: string; setCookie: string } | { ok: false; limited: boolean }> {
    const sourceHash = digest(source);
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    if (this.store.recentFailedAuth(sourceHash, since) >= 5) return { ok: false, limited: true };
    const valid = await verifyPassword(password, this.config.passwordHash);
    this.store.recordAuthAttempt(sourceHash, valid);
    if (!valid) return { ok: false, limited: false };
    const sessionId = randomBytes(32).toString("base64url"),
      csrfToken = randomBytes(32).toString("base64url"),
      now = Date.now(),
      idle = new Date(now + this.config.idleTtlSeconds * 1000).toISOString(),
      absolute = new Date(now + this.config.absoluteTtlSeconds * 1000).toISOString();
    this.store.createSession({
      sessionHash: digest(sessionId),
      csrfHash: digest(csrfToken),
      idleExpiresAt: idle,
      absoluteExpiresAt: absolute,
    });
    return {
      ok: true,
      csrfToken,
      setCookie: cookie(SESSION_COOKIE, sessionId, {
        secure: this.config.secureCookies,
        maxAge: this.config.absoluteTtlSeconds,
      }),
    };
  }
  authenticate(cookieHeader: string | undefined): OperatorSession | undefined {
    const id = parseCookies(cookieHeader)[SESSION_COOKIE];
    if (!id) return;
    const sessionHash = digest(id),
      row = this.store.getSession(sessionHash);
    if (
      !row ||
      typeof row.idle_expires_at !== "string" ||
      typeof row.absolute_expires_at !== "string" ||
      Date.parse(row.idle_expires_at) <= Date.now() ||
      Date.parse(row.absolute_expires_at) <= Date.now()
    ) {
      if (row) this.store.revokeSession(sessionHash);
      return;
    }
    this.store.touchSession(
      sessionHash,
      new Date(Date.now() + this.config.idleTtlSeconds * 1000).toISOString(),
    );
    return {
      sessionHash,
      csrfToken: String(row.csrf_hash),
      absoluteExpiresAt: row.absolute_expires_at,
    };
  }
  validateCsrf(session: OperatorSession, token: string | undefined): boolean {
    return Boolean(token && safeEqual(digest(token), session.csrfToken));
  }
  logout(session: OperatorSession): string {
    this.store.revokeSession(session.sessionHash);
    return cookie(SESSION_COOKIE, "", { secure: this.config.secureCookies, maxAge: 0 });
  }
}
export function securityHeaders(input: {
  production: boolean;
  https: boolean;
}): Record<string, string> {
  return {
    "content-security-policy":
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "same-site",
    ...(input.production && input.https
      ? { "strict-transport-security": "max-age=31536000; includeSubDomains" }
      : {}),
  };
}
export const operatorCookieName = SESSION_COOKIE;
