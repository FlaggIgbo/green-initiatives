export interface PasskeyChallengeCardProps {
  hasPasskey: boolean;
  busy: boolean;
  onRetryPasskey: () => void;
  onUseEmailOtp: () => void;
}

export function PasskeyChallengeCard({
  hasPasskey,
  busy,
  onRetryPasskey,
  onUseEmailOtp,
}: PasskeyChallengeCardProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 text-sm">
        <p className="font-semibold text-emerald-900">
          {hasPasskey ? "Passkey Verification" : "Set Up Your Passkey"}
        </p>
        <p className="mt-1 text-xs text-emerald-800">
          {hasPasskey
            ? "Confirm your identity using Touch ID, Face ID, or your device passkey."
            : "Protect your finance account by registering a passkey on this device."}
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={onRetryPasskey}
        className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy ? "Waiting for Passkey..." : hasPasskey ? "Verify with Passkey" : "Register Passkey"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onUseEmailOtp}
        className="w-full rounded-lg border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
      >
        Use Email OTP Instead
      </button>
    </div>
  );
}
