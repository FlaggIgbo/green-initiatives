export interface SandboxBankOption {
  institution: string;
  account: string;
  mask: string;
}

const DEFAULT_SANDBOX_BANKS: SandboxBankOption[] = [
  { institution: "Plaid Sandbox Bank", account: "Checking", mask: "1234" },
  { institution: "Chase", account: "Total Checking", mask: "4421" },
];

export interface PlaidLinkDialogProps {
  busy: boolean;
  banks?: SandboxBankOption[];
  inline?: boolean;
  onSelectBank: (institution: string, account: string, mask: string) => void;
  onClose: () => void;
}

export function PlaidLinkDialog({
  busy,
  banks = DEFAULT_SANDBOX_BANKS,
  inline = false,
  onSelectBank,
  onClose,
}: PlaidLinkDialogProps) {
  const dialogContent = (
    <div
      role="dialog"
      aria-label="Plaid Link"
      className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold">Plaid Link (Sandbox)</h3>
        <button
          type="button"
          aria-label="Close dialog"
          onClick={onClose}
          className="text-sm text-zinc-400 hover:text-zinc-700"
        >
          ✕
        </button>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Select a sandbox bank account to connect for spare-change round-ups.
      </p>
      <div className="mt-4 space-y-2">
        {banks.map((item) => (
          <button
            key={item.mask}
            type="button"
            disabled={busy}
            onClick={() => onSelectBank(item.institution, item.account, item.mask)}
            className="flex w-full items-center justify-between rounded-lg border border-zinc-200 p-3 text-left text-sm hover:border-emerald-500 hover:bg-emerald-50/40"
          >
            <div>
              <p className="font-semibold">{item.institution}</p>
              <p className="text-xs text-zinc-500">
                {item.account} •••• {item.mask}
              </p>
            </div>
            <span className="text-xs font-medium text-emerald-700">Connect</span>
          </button>
        ))}
      </div>
    </div>
  );

  if (inline) return dialogContent;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      {dialogContent}
    </div>
  );
}
