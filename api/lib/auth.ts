import crypto from "node:crypto";
import { env } from "./env";

const SECRET = () => env.appSecret || "dev-secret-change-me";

// ---- password hashing (scrypt) ----
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `s2:${salt.toString("base64")}:${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [v, saltB64, hashB64] = stored.split(":");
  if (v !== "s2" || !saltB64 || !hashB64) return false;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const actual = crypto.scryptSync(password, salt, expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

// ---- JWT (HS256) ----
function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

export function signToken(userId: number, username: string): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ uid: userId, un: username, exp: Date.now() + 30 * 86400_000 }),
  );
  const sig = crypto
    .createHmac("sha256", SECRET())
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${sig}`;
}

export function verifyToken(
  token: string,
): { uid: number; un: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const expected = crypto
    .createHmac("sha256", SECRET())
    .update(`${header}.${payload}`)
    .digest();
  let given: Buffer;
  try {
    given = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected))
    return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      uid: number;
      un: string;
      exp: number;
    };
    if (!data.exp || data.exp < Date.now()) return null;
    return { uid: data.uid, un: data.un };
  } catch {
    return null;
  }
}

export const AUTH_COOKIE = "xingbo_token";

export function getTokenFromRequest(req: Request): string | null {
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${AUTH_COOKIE}=([^;]+)`));
  if (m) return decodeURIComponent(m[1]);
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}
