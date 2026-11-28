import type { EsgBasket, LinkedAccount, PasskeySummary } from "@shared/types";
import { LinkedAccountsCard } from "../components/settings/LinkedAccountsCard";
import { EsgBasketSelector } from "../components/settings/EsgBasketSelector";
import { PasskeysCard } from "../components/settings/PasskeysCard";

export interface SettingsPageProps {
  accounts: LinkedAccount[];
  baskets: EsgBasket[];
  selectedBasketId: string;
  roundUpEnabled: boolean;
  passkeys: PasskeySummary[];
  busy: boolean;
  passkeySupported: boolean;
  onOpenPlaidLink: () => void;
  onUnlinkAccount: (accountId: string) => void;
  onSelectBasket: (basketId: string) => void;
  onToggleRoundUp: () => void;
  onAddPasskey: () => void;
  onDeletePasskey: (credentialId: string) => void;
}

export function SettingsPage({
  accounts,
  baskets,
  selectedBasketId,
  roundUpEnabled,
  passkeys,
  busy,
  passkeySupported,
  onOpenPlaidLink,
  onUnlinkAccount,
  onSelectBasket,
  onToggleRoundUp,
  onAddPasskey,
  onDeletePasskey,
}: SettingsPageProps) {
  return (
    <>
      <LinkedAccountsCard
        accounts={accounts}
        onOpenPlaidLink={onOpenPlaidLink}
        onUnlinkAccount={onUnlinkAccount}
      />

      <EsgBasketSelector
        baskets={baskets}
        selectedBasketId={selectedBasketId}
        roundUpEnabled={roundUpEnabled}
        onSelectBasket={onSelectBasket}
        onToggleRoundUp={onToggleRoundUp}
      />

      <PasskeysCard
        passkeys={passkeys}
        busy={busy}
        passkeySupported={passkeySupported}
        onAddPasskey={onAddPasskey}
        onDeletePasskey={onDeletePasskey}
      />
    </>
  );
}
