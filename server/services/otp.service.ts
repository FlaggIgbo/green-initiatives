/**
 * Auth Email OTP Service (Nodemailer SMTP + Redis short-TTL cache)
 *
 * Security controls:
 *  - Short-TTL ephemeral storage in Redis (`otp:<userId>`, 5-min TTL) — never stored on UserSchema.
 *  - Send cooldown (60s) + per-window send cap (max 5 sends / 15 min per user & per IP).
 *  - Atomic single-use consumption via Redis Lua compare-and-delete (prevents replay races).
 *  - Failed attempts preserve remaining TTL via Redis `KEEPTTL` and lock out after 5 failures.
 *  - Single-use `mfaToken` JTI revocation stored in Redis until token expiry (`SET ... NX EX`).
 *  - Always connects to the configured `REDIS_URL` (Docker locally, live Redis in production).
 *  - Console logging is used for SMTP delivery when `SMTP_HOST` is unset.
 */
import crypto from "node:crypto";
import nodemailer, { type Transporter } from "nodemailer";
import { createClient, type RedisClientType } from "redis";

export const OTP_TTL_SECONDS = 5 * 60; // 5 minutes
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60; // 60 seconds between sends
export const OTP_SEND_WINDOW_SECONDS = 15 * 60; // 15-minute rate-limit window
export const OTP_SEND_MAX_PER_WINDOW = 5; // max 5 sends per 15 minutes

export interface OtpRecord {
  codeHash: string;
  salt: string;
  attempts: number;
}

export interface SendSlotResult {
  allowed: boolean;
  retryAfterSeconds?: number;
  error?: string;
}

export interface OtpCacheStore {
  set(key: string, value: OtpRecord, ttlSeconds: number): Promise<void>;
  get(key: string): Promise<OtpRecord | null>;
  del(key: string): Promise<void>;
  /** Atomically delete key iff stored record's codeHash matches expectedCodeHash. */
  compareAndDelete(key: string, expectedCodeHash: string): Promise<boolean>;
  /** Atomically increment attempts while preserving remaining TTL (KEEPTTL). Deletes at maxAttempts. */
  incrementAttemptsKeepTtl(
    key: string,
    maxAttempts: number,
  ): Promise<"missing" | "locked" | "incremented">;
  /** Atomically check resend cooldown + per-window send cap (user & optional IP) and record send. */
  acquireSendSlot(params: {
    userId: string;
    ip?: string;
    cooldownSeconds: number;
    windowSeconds: number;
    maxPerWindow: number;
  }): Promise<SendSlotResult>;
  /** Atomically mark an mfaToken JTI as revoked (returns true if newly revoked, false if already revoked). */
  revokeMfaJti(jti: string, ttlSeconds: number): Promise<boolean>;
  /** Check whether an mfaToken JTI has already been revoked. */
  isMfaJtiRevoked(jti: string): Promise<boolean>;
}

const LUA_COMPARE_AND_DELETE = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local rec = cjson.decode(raw)
if rec.codeHash == ARGV[1] then
  redis.call('DEL', KEYS[1])
  return 1
end
return 0
`;

const LUA_INCREMENT_ATTEMPTS_KEEPTTL = `
local raw = redis.call('GET', KEYS[1])
if not raw then return -1 end
local rec = cjson.decode(raw)
local nextAttempts = (rec.attempts or 0) + 1
if nextAttempts >= tonumber(ARGV[1]) then
  redis.call('DEL', KEYS[1])
  return -2
end
rec.attempts = nextAttempts
redis.call('SET', KEYS[1], cjson.encode(rec), 'KEEPTTL')
return nextAttempts
`;

/**
 * KEYS[1] = cooldown key (otp:cooldown:<userId>)
 * KEYS[2] = user window counter (otp:sendcount:user:<userId>)
 * KEYS[3] = optional ip window counter (otp:sendcount:ip:<ip>) or ""
 * ARGV[1] = cooldownSeconds
 * ARGV[2] = windowSeconds
 * ARGV[3] = maxPerWindow
 * Returns { allowed (1|0), retryAfterSeconds, code (0=ok, 1=cooldown, 2=user_cap, 3=ip_cap) }
 */
const LUA_ACQUIRE_SEND_SLOT = `
local cooldownTtl = redis.call('TTL', KEYS[1])
if cooldownTtl > 0 then
  return {0, cooldownTtl, 1}
end

local userCount = tonumber(redis.call('GET', KEYS[2]) or '0')
local maxPerWindow = tonumber(ARGV[3])
if userCount >= maxPerWindow then
  local winTtl = redis.call('TTL', KEYS[2])
  if winTtl < 1 then winTtl = tonumber(ARGV[2]) end
  return {0, winTtl, 2}
end

if KEYS[3] and KEYS[3] ~= '' then
  local ipCount = tonumber(redis.call('GET', KEYS[3]) or '0')
  if ipCount >= maxPerWindow then
    local ipTtl = redis.call('TTL', KEYS[3])
    if ipTtl < 1 then ipTtl = tonumber(ARGV[2]) end
    return {0, ipTtl, 3}
  end
end

redis.call('SET', KEYS[1], '1', 'EX', tonumber(ARGV[1]))
local newUserCount = redis.call('INCR', KEYS[2])
if newUserCount == 1 then
  redis.call('EXPIRE', KEYS[2], tonumber(ARGV[2]))
end

if KEYS[3] and KEYS[3] ~= '' then
  local newIpCount = redis.call('INCR', KEYS[3])
  if newIpCount == 1 then
    redis.call('EXPIRE', KEYS[3], tonumber(ARGV[2]))
  end
end

return {1, 0, 0}
`;

class RedisOtpCacheStore implements OtpCacheStore {
  private client: RedisClientType | null = null;
  private connecting: Promise<RedisClientType> | null = null;

  constructor(private readonly url: string) {}

  async connect(): Promise<void> {
    await this.getClient();
  }

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

  async compareAndDelete(key: string, expectedCodeHash: string): Promise<boolean> {
    const client = await this.getClient();
    const res = await client.eval(LUA_COMPARE_AND_DELETE, {
      keys: [key],
      arguments: [expectedCodeHash],
    });
    return Number(res) === 1;
  }

  async incrementAttemptsKeepTtl(
    key: string,
    maxAttempts: number,
  ): Promise<"missing" | "locked" | "incremented"> {
    const client = await this.getClient();
    const res = Number(
      await client.eval(LUA_INCREMENT_ATTEMPTS_KEEPTTL, {
        keys: [key],
        arguments: [String(maxAttempts)],
      }),
    );
    if (res === -1) return "missing";
    if (res === -2) return "locked";
    return "incremented";
  }

  async acquireSendSlot(params: {
    userId: string;
    ip?: string;
    cooldownSeconds: number;
    windowSeconds: number;
    maxPerWindow: number;
  }): Promise<SendSlotResult> {
    const client = await this.getClient();
    const keys = [
      `otp:cooldown:${params.userId}`,
      `otp:sendcount:user:${params.userId}`,
      params.ip ? `otp:sendcount:ip:${params.ip}` : "",
    ];
    const [allowed, retryAfter, code] = (await client.eval(LUA_ACQUIRE_SEND_SLOT, {
      keys,
      arguments: [
        String(params.cooldownSeconds),
        String(params.windowSeconds),
        String(params.maxPerWindow),
      ],
    })) as [number, number, number];

    if (Number(allowed) === 1) return { allowed: true };
    const retryAfterSeconds = Math.max(1, Number(retryAfter));
    if (Number(code) === 1) {
      return {
        allowed: false,
        retryAfterSeconds,
        error: `Please wait ${retryAfterSeconds}s before requesting another verification code.`,
      };
    }
    return {
      allowed: false,
      retryAfterSeconds,
      error: "Too many verification codes requested. Please try again later.",
    };
  }

  async revokeMfaJti(jti: string, ttlSeconds: number): Promise<boolean> {
    const client = await this.getClient();
    const res = await client.set(`mfa:revoked:${jti}`, "1", {
      NX: true,
      EX: Math.max(1, Math.ceil(ttlSeconds)),
    });
    return res === "OK";
  }

  async isMfaJtiRevoked(jti: string): Promise<boolean> {
    const client = await this.getClient();
    const val = await client.get(`mfa:revoked:${jti}`);
    return val !== null;
  }
}

let defaultStore: RedisOtpCacheStore | null = null;

function getOtpStore(): RedisOtpCacheStore {
  if (!defaultStore) {
    const redisUrl = process.env.REDIS_URL?.trim();
    if (!redisUrl) {
      throw new Error(
        "REDIS_URL is required. Set it in .env (e.g. redis://localhost:6379 after running 'npm run services:up').",
      );
    }
    defaultStore = new RedisOtpCacheStore(redisUrl);
  }
  return defaultStore;
}

export async function connectOtpRedis(): Promise<void> {
  await getOtpStore().connect();
  console.info("[redis] Connected to Redis");
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

export type IssueOtpResult =
  | { ok: true; code: string; delivery: "smtp" | "console"; expiresInSeconds: number }
  | { ok: false; status: 429; error: string; retryAfterSeconds: number };

export async function issueEmailOtp(
  userId: string,
  email: string,
  options?: {
    ip?: string;
    store?: OtpCacheStore;
    transporter?: Transporter | null;
    ttlSeconds?: number;
    cooldownSeconds?: number;
    windowSeconds?: number;
    maxPerWindow?: number;
  },
): Promise<IssueOtpResult> {
  const store = options?.store ?? getOtpStore();
  const slot = await store.acquireSendSlot({
    userId,
    ip: options?.ip,
    cooldownSeconds: options?.cooldownSeconds ?? OTP_RESEND_COOLDOWN_SECONDS,
    windowSeconds: options?.windowSeconds ?? OTP_SEND_WINDOW_SECONDS,
    maxPerWindow: options?.maxPerWindow ?? OTP_SEND_MAX_PER_WINDOW,
  });

  if (!slot.allowed) {
    return {
      ok: false,
      status: 429,
      error: slot.error || "Too many verification code requests. Please wait.",
      retryAfterSeconds: slot.retryAfterSeconds ?? OTP_RESEND_COOLDOWN_SECONDS,
    };
  }

  const ttlSeconds = options?.ttlSeconds ?? OTP_TTL_SECONDS;
  const code = generateOtpCode();
  const salt = crypto.randomBytes(16).toString("hex");

  await store.set(
    otpCacheKey(userId),
    { codeHash: hashOtpCode(code, salt), salt, attempts: 0 },
    ttlSeconds,
  );
  const { delivery } = await sendEmailOtp(email, code, options?.transporter);

  return { ok: true, code, delivery, expiresInSeconds: ttlSeconds };
}

export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; status: 400 | 401 | 429; error: string };

export async function verifyStoredEmailOtp(
  userId: string,
  code: string,
  options?: { store?: OtpCacheStore },
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
    const outcome = await store.incrementAttemptsKeepTtl(key, OTP_MAX_ATTEMPTS);
    if (outcome === "missing") {
      return {
        ok: false,
        status: 400,
        error: "No active or unexpired verification code. Request a new code.",
      };
    }
    if (outcome === "locked") {
      return {
        ok: false,
        status: 429,
        error: "Too many failed attempts. Request a new code.",
      };
    }
    return { ok: false, status: 401, error: "Invalid verification code" };
  }

  // Atomic single-use consumption (prevents concurrent replay races)
  const consumed = await store.compareAndDelete(key, record.codeHash);
  if (!consumed) {
    return {
      ok: false,
      status: 400,
      error: "Verification code has already been used or expired.",
    };
  }

  return { ok: true };
}

export async function revokeMfaTokenJti(
  jti: string,
  expMs: number,
  store?: OtpCacheStore,
): Promise<boolean> {
  const targetStore = store ?? getOtpStore();
  const remainingSeconds = Math.max(1, Math.ceil((expMs - Date.now()) / 1000));
  return targetStore.revokeMfaJti(jti, remainingSeconds);
}

export async function isMfaTokenJtiRevoked(jti: string, store?: OtpCacheStore): Promise<boolean> {
  const targetStore = store ?? getOtpStore();
  return targetStore.isMfaJtiRevoked(jti);
}
