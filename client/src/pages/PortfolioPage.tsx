import type { PortfolioPosition, RoundUpTransaction } from "@shared/types";
import { PortfolioValueCard } from "../components/portfolio/PortfolioValueCard";
import { RoundUpProgressCard } from "../components/portfolio/RoundUpProgressCard";
import { HoldingsTable } from "../components/portfolio/HoldingsTable";
import { RecentTransactionsList } from "../components/portfolio/RecentTransactionsList";

export interface PortfolioPageProps {
  totalPortfolioValue: number;
  activeBasketName: string;
  balanceCents: number;
  thresholdCents: number;
  positions: PortfolioPosition[];
  recentTransactions: RoundUpTransaction[];
  busy: boolean;
  canSync: boolean;
  onSyncPlaid: () => void;
  onFlushToAlpaca: () => void;
}

export function PortfolioPage({
  totalPortfolioValue,
  activeBasketName,
  balanceCents,
  thresholdCents,
  positions,
  recentTransactions,
  busy,
  canSync,
  onSyncPlaid,
  onFlushToAlpaca,
}: PortfolioPageProps) {
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2">
        <PortfolioValueCard totalValue={totalPortfolioValue} activeBasketName={activeBasketName} />
        <RoundUpProgressCard
          balanceCents={balanceCents}
          thresholdCents={thresholdCents}
          busy={busy}
          canSync={canSync}
          onSyncPlaid={onSyncPlaid}
          onFlushToAlpaca={onFlushToAlpaca}
        />
      </section>

      <HoldingsTable positions={positions} />
      <RecentTransactionsList transactions={recentTransactions} />
    </>
  );
}
