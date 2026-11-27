import type { LedgerEntry, LedgerEntryStatus } from "@shared/schema-mongo";

/**
 * Double-Entry Ledger Service (Stubs)
 *
 * Replaces single mutable `roundUpBalanceCents` counter with an auditable,
 * append-only `ledger_entries` collection and idempotent state transitions:
 *   ACCRUED -> PENDING_SETTLEMENT -> INVESTED | FAILED
 */

export type NewLedgerEntry = Omit<LedgerEntry, "id" | "createdAt">;

export class LedgerService {
  /**
   * Append a double-entry ledger record inside a MongoDB session/transaction.
   * TODO:
   * 1. Enforce unique index on `idempotencyKey` so webhook/cron retries never double-count
   * 2. Use mongoose.startSession() + withTransaction() to keep ledger + summary in sync
   */
  async recordLedgerEntry(_entry: NewLedgerEntry): Promise<LedgerEntry> {
    throw new Error("TODO: Implement LedgerService.recordLedgerEntry with MongoDB transactions");
  }

  /**
   * Compute a user's current uninvested round-up balance directly from ledger entries.
   * TODO: Aggregate (SUM(creditCents) - SUM(debitCents)) for ACCRUED entries in `ledger_entries`.
   */
  async getLedgerBalanceCents(_userId: string): Promise<number> {
    throw new Error("TODO: Implement LedgerService.getLedgerBalanceCents");
  }

  /**
   * Idempotent state machine transition for a round-up flush batch.
   * TODO:
   * 1. Validate allowed transitions (ACCRUED -> PENDING_SETTLEMENT -> INVESTED | FAILED)
   * 2. Atomically update batch status and write offsetting ledger entry on failure/rollback
   */
  async transitionBatchState(
    _batchId: string,
    _fromStatus: LedgerEntryStatus,
    _toStatus: LedgerEntryStatus,
    _metadata?: { brokerOrderId?: string; reason?: string },
  ): Promise<void> {
    throw new Error("TODO: Implement LedgerService.transitionBatchState");
  }
}

export const ledgerService = new LedgerService();
