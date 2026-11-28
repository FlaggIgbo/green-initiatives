import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const COOKIE_NAME = "gi_session";

function getSecret(): string {
  return process.env.SESSION_SECRET || "dev-session-secret-change-me";
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, keyHex] = stored.split(":");
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const key = Buffer.from(keyHex, "hex");
  return derived.length === key.length && crypto.timingSafeEqual(derived, key);
}

export function signSessionToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, scope: "session", iat: Date.now() }),
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): string | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      uid?: string;
      scope?: string;
    };
    if (parsed.scope && parsed.scope !== "session") return null;
    return parsed.uid ?? null;
  } catch {
    return null;
  }
}

const MFA_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface MfaTokenPayload {
  userId: string;
  jti: string;
  exp: number;
}

export function signMfaToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      uid: userId,
      jti: crypto.randomUUID(),
      scope: "mfa",
      iat: Date.now(),
      exp: Date.now() + MFA_TOKEN_TTL_MS,
    }),
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyMfaTokenPayload(token: string): MfaTokenPayload | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      uid?: string;
      jti?: string;
      scope?: string;
      exp?: number;
    };
    if (parsed.scope !== "mfa" || !parsed.uid || !parsed.jti) return null;
    if (typeof parsed.exp !== "number" || parsed.exp < Date.now()) return null;
    return { userId: parsed.uid, jti: parsed.jti, exp: parsed.exp };
  } catch {
    return null;
  }
}

export function verifyMfaToken(token: string): string | null {
  return verifyMfaTokenPayload(token)?.userId ?? null;
}

export function getSessionUserId(req: Request): string | null {
  const token = parseCookie(req.headers.cookie, COOKIE_NAME);
  return token ? verifySessionToken(token) : null;
}

export function parseCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function setSessionCookie(res: Response, userId: string): void {
  const token = signSessionToken(userId);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`,
  );
}

export function clearSessionCookie(res: Response): void {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export interface AuthedRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = parseCookie(req.headers.cookie, COOKIE_NAME);
  const userId = token ? verifySessionToken(token) : null;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.userId = userId;
  next();
}
