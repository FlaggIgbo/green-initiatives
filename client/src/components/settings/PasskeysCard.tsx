import type { PasskeySummary } from "@shared/types";

export interface PasskeysCardProps {
  passkeys: PasskeySummary[];
  busy: boolean;
  passkeySupported: boolean;
  onAddPasskey: () => void;
  onDeletePasskey: (credentialId: string) => void;
}

export function PasskeysCard({
  passkeys,
  busy,
  passkeySupported,
  onAddPasskey,
  onDeletePasskey,
}: PasskeysCardProps) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Security &amp; Passkeys (WebAuthn)</h2>
          <p className="text-xs text-zinc-500">
            Passkeys protect sign-ins after password entry, with Email OTP via SMTP as fallback.
          </p>
        </div>
        <button
          type="button"
          disabled={busy || !passkeySupported}
          onClick={onAddPasskey}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Add Passkey
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {passkeys.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No passkeys registered yet. Add one for phishing-resistant two-step sign-in.
          </p>
        ) : (
          passkeys.map((pk) => (
            <div
              key={pk.credentialId}
              className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 text-sm"
            >
              <div>
                <p className="font-medium">{pk.label}</p>
                <p className="text-xs text-zinc-500">
                  Added {new Date(pk.createdAt).toLocaleDateString()}
                  {pk.lastUsedAt
                    ? ` • Last used ${new Date(pk.lastUsedAt).toLocaleDateString()}`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDeletePasskey(pk.credentialId)}
                className="text-xs text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
