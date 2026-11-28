/**
 * Browser Credential Management API (navigator.credentials) helpers:
 *  - PasswordCredential: get / store / preventSilentAccess for username + password login
 *  - PublicKeyCredential (WebAuthn): create / get for Passkeys (step-up MFA)
 *
 * Note: The WebOTP API (navigator.credentials.get({ otp: { transport: ["sms"] } }))
 * only supports SMS, not Email OTP. Email OTP uses <input autoComplete="one-time-code" />.
 */
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@shared/types";

interface BrowserPasswordCredential extends Credential {
  readonly password?: string;
  readonly name?: string;
}

interface PasswordCredentialCtor {
  new (data: { id: string; password: string; name?: string }): BrowserPasswordCredential;
}

function getPasswordCredentialCtor(): PasswordCredentialCtor | null {
  if (typeof window === "undefined") return null;
  const ctor = (window as unknown as { PasswordCredential?: PasswordCredentialCtor })
    .PasswordCredential;
  return typeof ctor === "function" ? ctor : null;
}

export function isPasswordCredentialSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "credentials" in navigator &&
    getPasswordCredentialCtor() !== null
  );
}

export function isPasskeySupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.credentials?.create === "function" &&
    typeof navigator.credentials?.get === "function"
  );
}

export async function getStoredPasswordCredential(
  mediation: CredentialMediationRequirement = "optional",
): Promise<{ email: string; password: string } | null> {
  if (!isPasswordCredentialSupported()) return null;
  try {
    const cred = (await navigator.credentials.get({
      password: true,
      mediation,
    } as CredentialRequestOptions)) as BrowserPasswordCredential | null;
    if (cred && cred.type === "password" && cred.id && cred.password) {
      return { email: cred.id, password: cred.password };
    }
  } catch {
    // Ignore browser rejections / unsupported environments
  }
  return null;
}

export async function storePasswordCredential(email: string, password: string): Promise<void> {
  const PasswordCredentialClass = getPasswordCredentialCtor();
  if (!PasswordCredentialClass || !navigator.credentials?.store || !email || !password) return;
  try {
    const cred = new PasswordCredentialClass({ id: email, password, name: email });
    await navigator.credentials.store(cred);
  } catch {
    // Non-fatal: browser may decline storing credentials (e.g. insecure context or user preference)
  }
}

export async function preventSilentCredentialAccess(): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.credentials?.preventSilentAccess) return;
  try {
    await navigator.credentials.preventSilentAccess();
  } catch {
    // Ignore if unsupported
  }
}

export function bufferToBase64Url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64UrlToUint8Array(base64url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

export interface SerializedPasskeyRegistration {
  id: string;
  rawId: string;
  response: {
    clientDataJSON: string;
    attestationObject: string;
    authenticatorData?: string;
    publicKey?: string;
    publicKeyAlgorithm?: number;
    transports?: string[];
  };
  label?: string;
}

export async function createPasskey(
  options: PublicKeyCredentialCreationOptionsJSON,
  label?: string,
): Promise<SerializedPasskeyRegistration> {
  if (!isPasskeySupported()) {
    throw new Error("Passkeys are not supported in this browser");
  }

  const publicKey: PublicKeyCredentialCreationOptions = {
    challenge: base64UrlToUint8Array(options.challenge),
    rp: options.rp,
    user: {
      id: base64UrlToUint8Array(options.user.id),
      name: options.user.name,
      displayName: options.user.displayName,
    },
    pubKeyCredParams: options.pubKeyCredParams,
    timeout: options.timeout,
    excludeCredentials: options.excludeCredentials.map((c) => ({
      id: base64UrlToUint8Array(c.id),
      type: c.type,
      transports: c.transports as AuthenticatorTransport[] | undefined,
    })),
    authenticatorSelection: options.authenticatorSelection,
    attestation: options.attestation,
  };

  const credential = (await navigator.credentials.create({
    publicKey,
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error("Passkey creation was cancelled");
  }

  const response = credential.response as AuthenticatorAttestationResponse;
  const pubKeyBuf =
    typeof response.getPublicKey === "function" ? response.getPublicKey() : null;
  const authDataBuf =
    typeof response.getAuthenticatorData === "function" ? response.getAuthenticatorData() : null;
  const transports =
    typeof response.getTransports === "function" ? response.getTransports() : undefined;

  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    response: {
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      attestationObject: bufferToBase64Url(response.attestationObject),
      authenticatorData: authDataBuf ? bufferToBase64Url(authDataBuf) : undefined,
      publicKey: pubKeyBuf ? bufferToBase64Url(pubKeyBuf) : undefined,
      publicKeyAlgorithm:
        typeof response.getPublicKeyAlgorithm === "function"
          ? response.getPublicKeyAlgorithm()
          : undefined,
      transports,
    },
    label: label || "Device Passkey",
  };
}

export interface SerializedPasskeyAssertion {
  id: string;
  rawId: string;
  response: {
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
    userHandle?: string;
  };
}

export async function authenticateWithPasskey(
  options: PublicKeyCredentialRequestOptionsJSON,
): Promise<SerializedPasskeyAssertion> {
  if (!isPasskeySupported()) {
    throw new Error("Passkeys are not supported in this browser");
  }

  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge: base64UrlToUint8Array(options.challenge),
    rpId: options.rpId,
    timeout: options.timeout,
    userVerification: options.userVerification,
    allowCredentials: options.allowCredentials.map((c) => ({
      id: base64UrlToUint8Array(c.id),
      type: c.type,
      transports: c.transports as AuthenticatorTransport[] | undefined,
    })),
  };

  const credential = (await navigator.credentials.get({
    publicKey,
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error("Passkey verification was cancelled");
  }

  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    response: {
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      authenticatorData: bufferToBase64Url(response.authenticatorData),
      signature: bufferToBase64Url(response.signature),
      userHandle: response.userHandle ? bufferToBase64Url(response.userHandle) : undefined,
    },
  };
}
