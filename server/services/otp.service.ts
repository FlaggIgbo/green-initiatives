/**
 * Auth Email OTP Service (Nodemailer SMTP + Redis short-TTL cache)
 *
 * - Stores ephemeral OTP records in Redis (`otp:<userId>`) with a 5-minute TTL (`EX`)
 *   so no OTP fields pollute the MongoDB User schema.
 * - Falls back to an in-memory TTL cache when REDIS_URL is not configured.
 * - Sends OTP emails via Nodemailer SMTP when SMTP_HOST is configured; logs to console in dev.
 */
import crypto from "node:crypto";
import nodemailer, { type Transporter } from "nodemailer";
import { createClient, type RedisClientType } from "redis";

export const OTP_TTL_SECONDS = 5 * 60; // 5 minutes
export const OTP_MAX_ATTEMPTS = 5;

export interface OtpRecord {
  codeHash: string;
  salt: string;
  attempts: number;
}

export interface OtpCacheStore {
  set(key: string, value: OtpRecord, ttlSeconds: number): Promise<void>;
  get(key: string): Promise<OtpRecord | null>;
  del(key: string): Promise<void>;
}

/** In-memory TTL fallback used when REDIS_URL is not set (local dev / unit tests). */
export class InMemoryOtpCacheStore implements OtpCacheStore {
  private map = new Map<string, { value: OtpRecord; expiresAt: number }>();

  async set(key: string, value: OtpRecord, ttlSeconds: number): Promise<void> {
    this.map.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async get(key: string): Promise<OtpRecord | null> {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.map.delete(key);
      return null;
    }
    return entry.value;
  }

  async del(key: string): Promise<void> {
    this.map.delete(key);
  }
}

class RedisOtpCacheStore implements OtpCacheStore {
  private client: RedisClientType | null = null;
  private connecting: Promise<RedisClientType> | null = null;

  constructor(private readonly url: string) {}

  private async getClient(): Promise<RedisClientType> {
    if (this.client?.isOpen) return this.client;
    if (!this.connecting) {
      const client = createClient({ url: this.url }) as RedisClientType;
      client.on("error", (err) => {
        console.error("[redis] OTP cache client error:", err);
      });
      this.connecting = client.connect().then(() => {
        this.client = client;
        this.connecting = null;
        return client;
      });
    }
    return this.connecting;
  }

  async set(key: string, value: OtpRecord, ttlSeconds: number): Promise<void> {
    const client = await this.getClient();
    await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
  }

  async get(key: string): Promise<OtpRecord | null> {
    const client = await this.getClient();
    const raw = await client.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as OtpRecord;
  }

  async del(key: string): Promise<void> {
    const client = await this.getClient();
    await client.del(key);
  }
}

let defaultStore: OtpCacheStore | null = null;

function getOtpStore(): OtpCacheStore {
  if (!defaultStore) {
    const redisUrl = process.env.REDIS_URL?.trim();
    defaultStore = redisUrl ? new RedisOtpCacheStore(redisUrl) : new InMemoryOtpCacheStore();
  }
  return defaultStore;
}

function otpCacheKey(userId: string): string {
  return `otp:${userId}`;
}

function getOtpSecret(): string {
  return process.env.SESSION_SECRET || "dev-session-secret-change-me";
}

export function generateOtpCode(): string {
  return String(crypto.randomInt(100_000, 1_000_000));
}

export function hashOtpCode(code: string, salt: string): string {
  return crypto
    .createHmac("sha256", getOtpSecret())
    .update(`${salt}:${code.trim()}`)
    .digest("hex");
}

export function verifyOtpCode(code: string, salt: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashOtpCode(code, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function createSmtpTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    ...(user && pass ? { auth: { user, pass } } : {}),
  });
}

export async function sendEmailOtp(
  email: string,
  code: string,
  transporterOverride?: Transporter | null,
): Promise<{ delivery: "smtp" | "console" }> {
  const from =
    process.env.SMTP_FROM?.trim() || "Green Initiatives <no-reply@green-initiatives.local>";
  const subject = `Your Green Initiatives verification code: ${code}`;
  const text = [
    `Your Green Initiatives one-time verification code is: ${code}`,
    "",
    `This code expires in ${Math.round(OTP_TTL_SECONDS / 60)} minutes.`,
    "If you did not try to sign in, you can safely ignore this email.",
  ].join("\n");

  const transporter =
    transporterOverride !== undefined ? transporterOverride : createSmtpTransporter();

  if (!transporter) {
    console.info(`[smtp:dev-fallback] Email OTP for ${email}: ${code}`);
    return { delivery: "console" };
  }

  await transporter.sendMail({ from, to: email, subject, text });
  return { delivery: "smtp" };
}

export async function issueEmailOtp(
  userId: string,
  email: string,
  options?: { store?: OtpCacheStore; transporter?: Transporter | null; ttlSeconds?: number },
): Promise<{ code: string; delivery: "smtp" | "console"; expiresInSeconds: number }> {
  const store = options?.store ?? getOtpStore();
  const ttlSeconds = options?.ttlSeconds ?? OTP_TTL_SECONDS;
  const code = generateOtpCode();
  const salt = crypto.randomBytes(16).toString("hex");

  await store.set(otpCacheKey(userId), { codeHash: hashOtpCode(code, salt), salt, attempts: 0 }, ttlSeconds);
  const { delivery } = await sendEmailOtp(email, code, options?.transporter);

  return { code, delivery, expiresInSeconds: ttlSeconds };
}

export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; status: 400 | 401 | 429; error: string };

export async function verifyStoredEmailOtp(
  userId: string,
  code: string,
  options?: { store?: OtpCacheStore; ttlSeconds?: number },
): Promise<VerifyOtpResult> {
  const store = options?.store ?? getOtpStore();
  const key = otpCacheKey(userId);
  const record = await store.get(key);

  if (!record) {
    return {
      ok: false,
      status: 400,
      error: "No active or unexpired verification code. Request a new code.",
    };
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    await store.del(key);
    return {
      ok: false,
      status: 429,
      error: "Too many failed attempts. Request a new code.",
    };
  }

  if (!verifyOtpCode(code, record.salt, record.codeHash)) {
    const nextAttempts = record.attempts + 1;
    if (nextAttempts >= OTP_MAX_ATTEMPTS) {
      await store.del(key);
      return {
        ok: false,
        status: 429,
        error: "Too many failed attempts. Request a new code.",
      };
    }
    await store.set(
      key,
      { ...record, attempts: nextAttempts },
      options?.ttlSeconds ?? OTP_TTL_SECONDS,
    );
    return { ok: false, status: 401, error: "Invalid verification code" };
  }

  await store.del(key);
  return { ok: true };
}
