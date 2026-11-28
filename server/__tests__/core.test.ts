import crypto from "node:crypto";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import nodemailer, { type SendMailOptions, type Transporter } from "nodemailer";
import { calculateRoundUpCents } from "../services/roundup.service";
import {
  hashPassword,
  verifyPassword,
  signSessionToken,
  verifySessionToken,
  signMfaToken,
  verifyMfaToken,
  verifyMfaTokenPayload,
} from "../auth";
import { ESG_BASKETS } from "../services/alpaca.service";
import {
  generateChallenge,
  toBase64Url,
  verifyPasskeyAuthentication,
  verifyPasskeyRegistration,
} from "../services/webauthn.service";
import {
  generateOtpCode,
  hashOtpCode,
  InMemoryOtpCacheStore,
  isMfaTokenJtiRevoked,
  issueEmailOtp,
  revokeMfaTokenJti,
  verifyOtpCode,
  verifyStoredEmailOtp,
} from "../services/otp.service";

describe("calculateRoundUpCents", () => {
  it("rounds posted debits up to the nearest dollar", () => {
    assert.equal(calculateRoundUpCents(435), 65);
    assert.equal(calculateRoundUpCents(2840), 60);
    assert.equal(calculateRoundUpCents(1), 99);
  });

  it("returns 0 for exact dollar amounts and non-positive values", () => {
    assert.equal(calculateRoundUpCents(500), 0);
    assert.equal(calculateRoundUpCents(0), 0);
    assert.equal(calculateRoundUpCents(-250), 0);
  });
});

describe("native crypto auth", () => {
  it("hashes and verifies passwords with scrypt", () => {
    const hash = hashPassword("s3cret-pass");
    assert.equal(verifyPassword("s3cret-pass", hash), true);
    assert.equal(verifyPassword("wrong-pass", hash), false);
  });

  it("signs and verifies HMAC session tokens", () => {
    const token = signSessionToken("user_123");
    assert.equal(verifySessionToken(token), "user_123");
    assert.equal(verifySessionToken(`${token}tampered`), null);
  });

  it("isolates MFA tokens from session tokens", () => {
    const mfaToken = signMfaToken("user_123");
    assert.equal(verifyMfaToken(mfaToken), "user_123");
    assert.equal(verifySessionToken(mfaToken), null);

    const sessionToken = signSessionToken("user_123");
    assert.equal(verifyMfaToken(sessionToken), null);
  });
});

describe("WebAuthn passkey verification", () => {
  it("verifies ES256 passkey registration and signed authentication assertion", () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });
    const spkiDer = publicKey.export({ type: "spki", format: "der" }) as Buffer;
    const rpId = "localhost";
    const origin = "http://localhost:8000";
    const regChallenge = generateChallenge();
    const credId = toBase64Url(crypto.randomBytes(32));

    // Build minimal authenticatorData (rpIdHash + UP flag + signCount=0)
    const rpIdHash = crypto.createHash("sha256").update(rpId).digest();
    const regAuthData = Buffer.concat([rpIdHash, Buffer.from([0x01, 0, 0, 0, 0])]);
    const regClientData = Buffer.from(
      JSON.stringify({ type: "webauthn.create", challenge: regChallenge, origin }),
    );

    const stored = verifyPasskeyRegistration(
      {
        id: credId,
        rawId: credId,
        response: {
          clientDataJSON: toBase64Url(regClientData),
          authenticatorData: toBase64Url(regAuthData),
          publicKey: toBase64Url(spkiDer),
          publicKeyAlgorithm: -7,
          transports: ["internal"],
        },
        label: "MacBook Touch ID",
      },
      regChallenge,
      origin,
      rpId,
    );

    assert.equal(stored.credentialId, credId);
    assert.equal(stored.label, "MacBook Touch ID");

    // Now sign a real WebAuthn assertion
    const authChallenge = generateChallenge();
    const authClientData = Buffer.from(
      JSON.stringify({ type: "webauthn.get", challenge: authChallenge, origin }),
    );
    const authData = Buffer.concat([rpIdHash, Buffer.from([0x05, 0, 0, 0, 1])]); // UP+UV, signCount=1
    const clientDataHash = crypto.createHash("sha256").update(authClientData).digest();
    const signature = crypto.sign("sha256", Buffer.concat([authData, clientDataHash]), privateKey);

    const verified = verifyPasskeyAuthentication(
      {
        id: credId,
        rawId: credId,
        response: {
          clientDataJSON: toBase64Url(authClientData),
          authenticatorData: toBase64Url(authData),
          signature: toBase64Url(signature),
        },
      },
      stored,
      authChallenge,
      origin,
      rpId,
    );
    assert.equal(verified.newSignCount, 1);

    // Tampered signature must fail
    const badSig = Buffer.from(signature);
    badSig[badSig.length - 1] ^= 0xff;
    assert.throws(() =>
      verifyPasskeyAuthentication(
        {
          id: credId,
          rawId: credId,
          response: {
            clientDataJSON: toBase64Url(authClientData),
            authenticatorData: toBase64Url(authData),
            signature: toBase64Url(badSig),
          },
        },
        stored,
        authChallenge,
        origin,
        rpId,
      ),
    );
  });
});

describe("Email OTP & SMTP delivery", () => {
  it("generates and verifies 6-digit OTP hashes", () => {
    const code = generateOtpCode();
    assert.match(code, /^\d{6}$/);
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = hashOtpCode(code, salt);
    assert.equal(verifyOtpCode(code, salt, hash), true);
    assert.equal(verifyOtpCode("000000", salt, hash), code === "000000");
  });

  it("issues, caches with TTL, sends via nodemailer, and verifies Email OTP atomically", async () => {
    const store = new InMemoryOtpCacheStore();
    const sentMessages: Array<{ to: unknown; subject: unknown; text: unknown }> = [];
    const baseTransport = nodemailer.createTransport({ jsonTransport: true });
    const spyTransport = {
      ...baseTransport,
      sendMail: async (mail: SendMailOptions) => {
        sentMessages.push({ to: mail.to, subject: mail.subject, text: mail.text });
        return baseTransport.sendMail(mail);
      },
    } as unknown as Transporter;

    const issued = await issueEmailOtp("usr_otp_1", "investor@example.com", {
      ip: "203.0.113.10",
      store,
      transporter: spyTransport,
      ttlSeconds: 300,
    });

    assert.equal(issued.ok, true);
    if (!issued.ok) return;
    assert.equal(issued.delivery, "smtp");
    assert.equal(issued.expiresInSeconds, 300);
    assert.equal(sentMessages.length, 1);
    assert.equal(sentMessages[0].to, "investor@example.com");
    assert.match(String(sentMessages[0].text), new RegExp(issued.code));

    // Immediate resend is blocked by cooldown (429)
    const cooldownRes = await issueEmailOtp("usr_otp_1", "investor@example.com", {
      ip: "203.0.113.10",
      store,
      transporter: spyTransport,
    });
    assert.equal(cooldownRes.ok, false);
    if (!cooldownRes.ok) {
      assert.equal(cooldownRes.status, 429);
      assert.ok(cooldownRes.retryAfterSeconds > 0);
    }

    // Wrong code increments attempts while preserving original expiry (KEEPTTL)
    const initialExp = store.getExpiresAt("otp:usr_otp_1");
    assert.ok(initialExp !== null);
    const wrongCode = issued.code === "000000" ? "111111" : "000000";
    const badResult = await verifyStoredEmailOtp("usr_otp_1", wrongCode, { store });
    assert.equal(badResult.ok, false);
    assert.equal(badResult.status, 401);
    assert.equal(store.getExpiresAt("otp:usr_otp_1"), initialExp);

    // Atomic single-use consumption: concurrent valid verifications allow only ONE winner
    const [r1, r2] = await Promise.all([
      verifyStoredEmailOtp("usr_otp_1", issued.code, { store }),
      verifyStoredEmailOtp("usr_otp_1", issued.code, { store }),
    ]);
    const successes = [r1, r2].filter((r) => r.ok);
    const failures = [r1, r2].filter((r) => !r.ok);
    assert.equal(successes.length, 1);
    assert.equal(failures.length, 1);
    assert.equal(failures[0].status, 400);
  });

  it("enforces per-window send cap and mfaToken JTI revocation", async () => {
    const store = new InMemoryOtpCacheStore();
    const s1 = await issueEmailOtp("usr_cap", "cap@example.com", {
      ip: "198.51.100.5",
      store,
      transporter: null,
      cooldownSeconds: 0,
      windowSeconds: 900,
      maxPerWindow: 2,
    });
    const s2 = await issueEmailOtp("usr_cap", "cap@example.com", {
      ip: "198.51.100.5",
      store,
      transporter: null,
      cooldownSeconds: 0,
      windowSeconds: 900,
      maxPerWindow: 2,
    });
    const s3 = await issueEmailOtp("usr_cap", "cap@example.com", {
      ip: "198.51.100.5",
      store,
      transporter: null,
      cooldownSeconds: 0,
      windowSeconds: 900,
      maxPerWindow: 2,
    });
    assert.equal(s1.ok, true);
    assert.equal(s2.ok, true);
    assert.equal(s3.ok, false);
    if (!s3.ok) assert.equal(s3.status, 429);

    // mfaToken JTI revocation is single-use
    const token = signMfaToken("usr_cap");
    const payload = verifyMfaTokenPayload(token);
    assert.ok(payload?.jti);
    assert.equal(await isMfaTokenJtiRevoked(payload.jti, store), false);
    assert.equal(await revokeMfaTokenJti(payload.jti, payload.exp, store), true);
    assert.equal(await isMfaTokenJtiRevoked(payload.jti, store), true);
    assert.equal(await revokeMfaTokenJti(payload.jti, payload.exp, store), false);
  });
});

describe("ESG baskets", () => {
  it("every basket's ETF weights sum to 1.0", () => {
    for (const basket of ESG_BASKETS) {
      const sum = basket.holdings.reduce((acc, h) => acc + h.weight, 0);
      assert.ok(Math.abs(sum - 1) < 1e-6, `Basket ${basket.id} weights sum to ${sum}`);
    }
  });
});
