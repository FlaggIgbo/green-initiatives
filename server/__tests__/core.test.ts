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
  issueEmailOtp,
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

  it("issues, caches with TTL, sends via nodemailer, and verifies Email OTP", async () => {
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
      store,
      transporter: spyTransport,
      ttlSeconds: 300,
    });

    assert.equal(issued.delivery, "smtp");
    assert.equal(issued.expiresInSeconds, 300);
    assert.equal(sentMessages.length, 1);
    assert.equal(sentMessages[0].to, "investor@example.com");
    assert.match(String(sentMessages[0].text), new RegExp(issued.code));

    // Wrong code is rejected
    const badResult = await verifyStoredEmailOtp("usr_otp_1", "000000", { store });
    if (issued.code !== "000000") {
      assert.equal(badResult.ok, false);
      assert.equal(badResult.status, 401);
    }

    // Correct code succeeds and clears cache entry (single-use)
    const okResult = await verifyStoredEmailOtp("usr_otp_1", issued.code, { store });
    assert.equal(okResult.ok, true);

    const replayResult = await verifyStoredEmailOtp("usr_otp_1", issued.code, { store });
    assert.equal(replayResult.ok, false);
    assert.equal(replayResult.status, 400);
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
