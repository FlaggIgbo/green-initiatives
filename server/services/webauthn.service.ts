/**
 * Native WebAuthn / Passkey Service (zero third-party dependencies, uses node:crypto)
 *
 * Implements FIDO2/WebAuthn registration (attestation) and authentication (assertion)
 * verification for ES256 (P-256) and RS256 (RSA) passkeys created via navigator.credentials.
 */
import crypto from "node:crypto";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@shared/types";

export const RP_NAME = "Green Initiatives";
export const CHALLENGE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function toBase64Url(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf).toString("base64url");
}

export function fromBase64Url(str: string): Buffer {
  return Buffer.from(str, "base64url");
}

export function generateChallenge(): string {
  return toBase64Url(crypto.randomBytes(32));
}

export function resolveRpConfig(headers: { host?: string; origin?: string }): {
  rpId: string;
  origin: string;
} {
  const hostHeader = headers.host || "localhost:8000";
  const hostname = hostHeader.split(":")[0] || "localhost";
  const rpId = process.env.RP_ID || hostname;
  const origin = process.env.RP_ORIGIN || headers.origin || `http://${hostHeader}`;
  return { rpId, origin };
}

export interface StoredPasskey {
  credentialId: string;
  publicKeySpki: string; // standard base64 DER SPKI
  algorithm: number; // COSE alg (-7 = ES256, -257 = RS256)
  signCount: number;
  transports?: string[];
  label: string;
}

export function buildRegistrationOptions(params: {
  userId: string;
  email: string;
  rpId: string;
  challenge: string;
  existingCredentialIds?: string[];
}): PublicKeyCredentialCreationOptionsJSON {
  return {
    challenge: params.challenge,
    rp: {
      id: params.rpId,
      name: RP_NAME,
    },
    user: {
      id: toBase64Url(Buffer.from(params.userId, "utf8")),
      name: params.email,
      displayName: params.email,
    },
    pubKeyCredParams: [
      { type: "public-key", alg: -7 }, // ES256 (ECDSA P-256 + SHA-256)
      { type: "public-key", alg: -257 }, // RS256 (RSASSA-PKCS1-v1_5 + SHA-256)
    ],
    timeout: 60_000,
    excludeCredentials: (params.existingCredentialIds || []).map((id) => ({
      id,
      type: "public-key" as const,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
    attestation: "none",
  };
}

export function buildAuthenticationOptions(params: {
  rpId: string;
  challenge: string;
  passkeys: Array<{ credentialId: string; transports?: string[] }>;
}): PublicKeyCredentialRequestOptionsJSON {
  return {
    challenge: params.challenge,
    rpId: params.rpId,
    timeout: 60_000,
    userVerification: "preferred",
    allowCredentials: params.passkeys.map((pk) => ({
      id: pk.credentialId,
      type: "public-key" as const,
      transports: pk.transports?.length ? pk.transports : undefined,
    })),
  };
}

// --- Minimal RFC 8949 CBOR decoder (sufficient for WebAuthn attestationObject & COSE keys) ---
function decodeCborValue(buf: Buffer, offset: number): { value: unknown; nextOffset: number } {
  if (offset >= buf.length) throw new Error("Unexpected end of CBOR data");
  const initial = buf[offset++];
  const major = initial >> 5;
  const additional = initial & 0x1f;

  const readUint = (): number => {
    if (additional < 24) return additional;
    if (additional === 24) return buf[offset++];
    if (additional === 25) {
      const v = buf.readUInt16BE(offset);
      offset += 2;
      return v;
    }
    if (additional === 26) {
      const v = buf.readUInt32BE(offset);
      offset += 4;
      return v;
    }
    if (additional === 27) {
      const v = Number(buf.readBigUInt64BE(offset));
      offset += 8;
      return v;
    }
    throw new Error(`Unsupported CBOR length indicator: ${additional}`);
  };

  if (major === 0) return { value: readUint(), nextOffset: offset };
  if (major === 1) return { value: -1 - readUint(), nextOffset: offset };
  if (major === 2) {
    const len = readUint();
    const slice = buf.subarray(offset, offset + len);
    return { value: Buffer.from(slice), nextOffset: offset + len };
  }
  if (major === 3) {
    const len = readUint();
    const str = buf.subarray(offset, offset + len).toString("utf8");
    return { value: str, nextOffset: offset + len };
  }
  if (major === 4) {
    const len = readUint();
    const arr: unknown[] = [];
    for (let i = 0; i < len; i++) {
      const item = decodeCborValue(buf, offset);
      arr.push(item.value);
      offset = item.nextOffset;
    }
    return { value: arr, nextOffset: offset };
  }
  if (major === 5) {
    const len = readUint();
    const map = new Map<unknown, unknown>();
    for (let i = 0; i < len; i++) {
      const k = decodeCborValue(buf, offset);
      offset = k.nextOffset;
      const v = decodeCborValue(buf, offset);
      offset = v.nextOffset;
      map.set(k.value, v.value);
    }
    return { value: map, nextOffset: offset };
  }
  if (major === 7) {
    if (additional === 20) return { value: false, nextOffset: offset };
    if (additional === 21) return { value: true, nextOffset: offset };
    if (additional === 22) return { value: null, nextOffset: offset };
    if (additional === 23) return { value: undefined, nextOffset: offset };
  }
  throw new Error(`Unsupported CBOR major type: ${major}`);
}

function coseKeyToSpki(coseMap: Map<unknown, unknown>): { spkiDer: Buffer; algorithm: number } {
  const kty = Number(coseMap.get(1));
  const alg = Number(coseMap.get(3));

  // EC2 (P-256 / ES256)
  if (kty === 2) {
    const crv = Number(coseMap.get(-1));
    const x = coseMap.get(-2);
    const y = coseMap.get(-3);
    if (crv !== 1 || !Buffer.isBuffer(x) || !Buffer.isBuffer(y)) {
      throw new Error("Unsupported EC COSE public key parameters");
    }
    const keyObj = crypto.createPublicKey({
      key: {
        kty: "EC",
        crv: "P-256",
        x: toBase64Url(x),
        y: toBase64Url(y),
      },
      format: "jwk",
    });
    return {
      spkiDer: keyObj.export({ type: "spki", format: "der" }) as Buffer,
      algorithm: alg || -7,
    };
  }

  // RSA (RS256)
  if (kty === 3) {
    const n = coseMap.get(-1);
    const e = coseMap.get(-2);
    if (!Buffer.isBuffer(n) || !Buffer.isBuffer(e)) {
      throw new Error("Unsupported RSA COSE public key parameters");
    }
    const keyObj = crypto.createPublicKey({
      key: {
        kty: "RSA",
        n: toBase64Url(n),
        e: toBase64Url(e),
      },
      format: "jwk",
    });
    return {
      spkiDer: keyObj.export({ type: "spki", format: "der" }) as Buffer,
      algorithm: alg || -257,
    };
  }

  throw new Error(`Unsupported COSE key type: ${kty}`);
}

interface ParsedAuthData {
  rpIdHash: Buffer;
  flags: number;
  signCount: number;
  credentialId?: Buffer;
  cosePublicKey?: Map<unknown, unknown>;
}

function parseAuthenticatorData(authData: Buffer): ParsedAuthData {
  if (authData.length < 37) {
    throw new Error("Invalid authenticatorData: too short");
  }
  const rpIdHash = authData.subarray(0, 32);
  const flags = authData[32];
  const signCount = authData.readUInt32BE(33);

  const hasAttestedCredentialData = (flags & 0x40) !== 0;
  if (!hasAttestedCredentialData) {
    return { rpIdHash, flags, signCount };
  }

  if (authData.length < 55) {
    throw new Error("Invalid authenticatorData: missing attested credential header");
  }
  const credIdLen = authData.readUInt16BE(53);
  const credIdStart = 55;
  const credIdEnd = credIdStart + credIdLen;
  if (authData.length < credIdEnd) {
    throw new Error("Invalid authenticatorData: truncated credentialId");
  }
  const credentialId = Buffer.from(authData.subarray(credIdStart, credIdEnd));
  const { value: coseVal } = decodeCborValue(authData, credIdEnd);
  if (!(coseVal instanceof Map)) {
    throw new Error("Invalid COSE public key in authenticatorData");
  }
  return { rpIdHash, flags, signCount, credentialId, cosePublicKey: coseVal };
}

function verifyClientData(
  clientDataJSONB64: string,
  expectedType: "webauthn.create" | "webauthn.get",
  expectedChallenge: string,
  expectedOrigin: string,
): Buffer {
  const clientDataBuf = fromBase64Url(clientDataJSONB64);
  let parsed: { type?: string; challenge?: string; origin?: string };
  try {
    parsed = JSON.parse(clientDataBuf.toString("utf8")) as {
      type?: string;
      challenge?: string;
      origin?: string;
    };
  } catch {
    throw new Error("Invalid clientDataJSON");
  }
  if (parsed.type !== expectedType) {
    throw new Error(`Unexpected WebAuthn type: ${parsed.type}`);
  }
  if (parsed.challenge !== expectedChallenge) {
    throw new Error("WebAuthn challenge mismatch");
  }
  if (parsed.origin !== expectedOrigin) {
    throw new Error(`WebAuthn origin mismatch: expected ${expectedOrigin}, got ${parsed.origin}`);
  }
  return clientDataBuf;
}

function verifyRpIdHashAndFlags(rpIdHash: Buffer, flags: number, expectedRpId: string): void {
  const expectedHash = crypto.createHash("sha256").update(expectedRpId).digest();
  if (rpIdHash.length !== expectedHash.length || !crypto.timingSafeEqual(rpIdHash, expectedHash)) {
    throw new Error("WebAuthn rpIdHash mismatch");
  }
  // Bit 0: User Present (UP) must be set
  if ((flags & 0x01) === 0) {
    throw new Error("WebAuthn User Present (UP) flag not set");
  }
}

export interface RegistrationVerificationInput {
  id: string;
  rawId: string;
  response: {
    clientDataJSON: string;
    attestationObject?: string;
    authenticatorData?: string;
    publicKey?: string;
    publicKeyAlgorithm?: number;
    transports?: string[];
  };
  label?: string;
}

export function verifyPasskeyRegistration(
  credential: RegistrationVerificationInput,
  expectedChallenge: string,
  expectedOrigin: string,
  expectedRpId: string,
): StoredPasskey {
  verifyClientData(
    credential.response.clientDataJSON,
    "webauthn.create",
    expectedChallenge,
    expectedOrigin,
  );

  let authDataBuf: Buffer;
  if (credential.response.attestationObject) {
    const attObjBuf = fromBase64Url(credential.response.attestationObject);
    const { value: attObj } = decodeCborValue(attObjBuf, 0);
    if (!(attObj instanceof Map)) {
      throw new Error("Invalid attestationObject CBOR");
    }
    const rawAuthData = attObj.get("authData");
    if (!Buffer.isBuffer(rawAuthData)) {
      throw new Error("Missing authData in attestationObject");
    }
    authDataBuf = rawAuthData;
  } else if (credential.response.authenticatorData) {
    authDataBuf = fromBase64Url(credential.response.authenticatorData);
  } else {
    throw new Error("Missing attestationObject or authenticatorData");
  }

  const parsedAuth = parseAuthenticatorData(authDataBuf);
  verifyRpIdHashAndFlags(parsedAuth.rpIdHash, parsedAuth.flags, expectedRpId);

  let spkiDer: Buffer;
  let algorithm = credential.response.publicKeyAlgorithm ?? -7;

  if (parsedAuth.cosePublicKey) {
    const converted = coseKeyToSpki(parsedAuth.cosePublicKey);
    spkiDer = converted.spkiDer;
    algorithm = converted.algorithm;
  } else if (credential.response.publicKey) {
    spkiDer = fromBase64Url(credential.response.publicKey);
    // Validate SPKI can be parsed by Node crypto
    crypto.createPublicKey({ key: spkiDer, format: "der", type: "spki" });
  } else {
    throw new Error("Could not extract public key from passkey registration");
  }

  const credentialId = parsedAuth.credentialId
    ? toBase64Url(parsedAuth.credentialId)
    : credential.id || credential.rawId;

  if (!credentialId) {
    throw new Error("Missing credentialId");
  }

  return {
    credentialId,
    publicKeySpki: spkiDer.toString("base64"),
    algorithm,
    signCount: parsedAuth.signCount,
    transports: credential.response.transports || [],
    label: credential.label?.trim() || "Passkey",
  };
}

export interface AuthenticationVerificationInput {
  id: string;
  rawId: string;
  response: {
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
  };
}

export function verifyPasskeyAuthentication(
  assertion: AuthenticationVerificationInput,
  storedPasskey: StoredPasskey,
  expectedChallenge: string,
  expectedOrigin: string,
  expectedRpId: string,
): { newSignCount: number } {
  const clientDataBuf = verifyClientData(
    assertion.response.clientDataJSON,
    "webauthn.get",
    expectedChallenge,
    expectedOrigin,
  );

  const authDataBuf = fromBase64Url(assertion.response.authenticatorData);
  const parsedAuth = parseAuthenticatorData(authDataBuf);
  verifyRpIdHashAndFlags(parsedAuth.rpIdHash, parsedAuth.flags, expectedRpId);

  const signatureBuf = fromBase64Url(assertion.response.signature);
  const clientDataHash = crypto.createHash("sha256").update(clientDataBuf).digest();
  const signedPayload = Buffer.concat([authDataBuf, clientDataHash]);

  const publicKey = crypto.createPublicKey({
    key: Buffer.from(storedPasskey.publicKeySpki, "base64"),
    format: "der",
    type: "spki",
  });

  const valid = crypto.verify("sha256", signedPayload, publicKey, signatureBuf);
  if (!valid) {
    throw new Error("Invalid passkey signature");
  }

  // Monotonic counter check (when authenticator supports counters > 0)
  if (
    (storedPasskey.signCount > 0 || parsedAuth.signCount > 0) &&
    parsedAuth.signCount <= storedPasskey.signCount
  ) {
    throw new Error("Passkey signature counter did not advance (possible cloned credential)");
  }

  return { newSignCount: parsedAuth.signCount };
}
