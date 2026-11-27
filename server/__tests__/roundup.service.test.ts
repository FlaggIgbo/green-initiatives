import {
  calculateRoundUpCents,
  processTransaction,
  flushRoundUpBalances,
} from "../services/roundup.service";
import { storage } from "../mongo/storage";
import { projectService } from "../services/project.service";
import type { User } from "@shared/schema-mongo";

describe("Round-up Service", () => {
  describe("calculateRoundUpCents", () => {
    it("rounds up $4.37 to $5.00 → 63 cents", () => {
      expect(calculateRoundUpCents(-437)).toBe(63);
    });

    it("rounds up $10.01 to $11.00 → 99 cents", () => {
      expect(calculateRoundUpCents(-1001)).toBe(99);
    });

    it("rounds up $1.00 to $1.00 → 0 cents (already whole dollar)", () => {
      expect(calculateRoundUpCents(-100)).toBe(0);
    });

    it("rounds up $0.01 to $1.00 → 99 cents", () => {
      expect(calculateRoundUpCents(-1)).toBe(99);
    });

    it("rounds up $99.99 to $100.00 → 1 cent", () => {
      expect(calculateRoundUpCents(-9999)).toBe(1);
    });

    it("returns 0 for credits (positive amounts)", () => {
      expect(calculateRoundUpCents(437)).toBe(0);
      expect(calculateRoundUpCents(100)).toBe(0);
      expect(calculateRoundUpCents(0)).toBe(0);
    });

    it("handles larger amounts correctly", () => {
      // $123.45 → $124.00 → 55 cents
      expect(calculateRoundUpCents(-12345)).toBe(55);
      // $50.50 → $51.00 → 50 cents
      expect(calculateRoundUpCents(-5050)).toBe(50);
    });
  });

  describe("processTransaction", () => {
    const projectId = "proj_123";
    const userId = "user_456";

    beforeEach(() => {
      jest.clearAllMocks();
      process.env.STRIPE_DISABLED = "false";
    });

    it("accumulates round-up (Acorns-style: no immediate donate)", async () => {
      const txnId = "fctxn_test_1";
      jest.spyOn(storage, "getProcessedRoundUpTransaction").mockResolvedValue(undefined);
      jest.spyOn(storage, "getUser").mockResolvedValue({
        id: userId,
        roundUpEnabled: true,
        roundUpProjectIds: [projectId],
      } as User);
      const addBalanceSpy = jest.spyOn(storage, "addRoundUpBalance").mockResolvedValue(63);
      const processFundingSpy = jest
        .spyOn(projectService, "processFunding")
        .mockResolvedValue({} as never);
      const createTxnSpy = jest
        .spyOn(storage, "createRoundUpTransaction")
        .mockResolvedValue({} as never);

      const result = await processTransaction(txnId, -437, userId);

      expect(result.processed).toBe(true);
      expect(result.roundUpCents).toBe(63);
      expect(addBalanceSpy).toHaveBeenCalledWith(userId, 63);
      expect(processFundingSpy).not.toHaveBeenCalled();
      expect(createTxnSpy).toHaveBeenCalledWith({
        userId,
        stripeTransactionId: txnId,
        originalAmountCents: -437,
        roundUpAmount: 0.63,
      });
    });

    it("accumulates round-up for multiple projects (split on flush)", async () => {
      const projectId2 = "proj_789";
      const txnId = "fctxn_test_2";
      jest.spyOn(storage, "getProcessedRoundUpTransaction").mockResolvedValue(undefined);
      jest.spyOn(storage, "getUser").mockResolvedValue({
        id: userId,
        roundUpEnabled: true,
        roundUpProjectIds: [projectId, projectId2],
      } as User);
      jest.spyOn(storage, "addRoundUpBalance").mockResolvedValue(63);
      const processFundingSpy = jest
        .spyOn(projectService, "processFunding")
        .mockResolvedValue({} as never);
      jest.spyOn(storage, "createRoundUpTransaction").mockResolvedValue({} as never);

      const result = await processTransaction(txnId, -437, userId);

      expect(result.processed).toBe(true);
      expect(result.roundUpCents).toBe(63);
      expect(processFundingSpy).not.toHaveBeenCalled();
    });

    it("deduplicates: does not process same transaction twice", async () => {
      const txnId = "fctxn_test_3";
      const addBalanceSpy = jest.spyOn(storage, "addRoundUpBalance").mockResolvedValue(63);
      jest
        .spyOn(storage, "getProcessedRoundUpTransaction")
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({
          id: "rec_1",
          userId,
          stripeTransactionId: txnId,
          originalAmountCents: -437,
          roundUpAmount: 0.63,
          processedAt: new Date(),
        } as never);
      jest.spyOn(storage, "getUser").mockResolvedValue({
        id: userId,
        roundUpEnabled: true,
        roundUpProjectIds: [projectId],
      } as User);
      jest.spyOn(storage, "createRoundUpTransaction").mockResolvedValue({} as never);

      const first = await processTransaction(txnId, -437, userId);
      const second = await processTransaction(txnId, -437, userId);

      expect(first.processed).toBe(true);
      expect(second.processed).toBe(false);
      expect(addBalanceSpy).toHaveBeenCalledTimes(1);
    });

    it("skips when round-up is disabled", async () => {
      const txnId = "fctxn_test_4";
      jest.spyOn(storage, "getProcessedRoundUpTransaction").mockResolvedValue(undefined);
      jest.spyOn(storage, "getUser").mockResolvedValue({
        id: userId,
        roundUpEnabled: false,
        roundUpProjectIds: [projectId],
      } as User);
      const processFundingSpy = jest
        .spyOn(projectService, "processFunding")
        .mockResolvedValue({} as never);

      const result = await processTransaction(txnId, -437, userId);

      expect(result.processed).toBe(false);
      expect(result.roundUpCents).toBe(63);
      expect(processFundingSpy).not.toHaveBeenCalled();
    });

    it("skips when no projects selected", async () => {
      const txnId = "fctxn_test_5";
      jest.spyOn(storage, "getProcessedRoundUpTransaction").mockResolvedValue(undefined);
      jest.spyOn(storage, "getUser").mockResolvedValue({
        id: userId,
        roundUpEnabled: true,
        roundUpProjectIds: [],
        selectedRoundUpProject: undefined,
      } as User);
      const processFundingSpy = jest
        .spyOn(projectService, "processFunding")
        .mockResolvedValue({} as never);

      const result = await processTransaction(txnId, -437, userId);

      expect(result.processed).toBe(false);
      expect(processFundingSpy).not.toHaveBeenCalled();
    });

    it("skips credits (positive amounts)", async () => {
      const txnId = "fctxn_test_6";
      jest.spyOn(storage, "getProcessedRoundUpTransaction").mockResolvedValue(undefined);
      jest.spyOn(storage, "getUser").mockResolvedValue({
        id: userId,
        roundUpEnabled: true,
        roundUpProjectIds: [projectId],
      } as User);
      const processFundingSpy = jest
        .spyOn(projectService, "processFunding")
        .mockResolvedValue({} as never);

      const result = await processTransaction(txnId, 437, userId);

      expect(result.processed).toBe(false);
      expect(result.roundUpCents).toBe(0);
      expect(processFundingSpy).not.toHaveBeenCalled();
    });

    it("skips whole-dollar debits (0 round-up)", async () => {
      const txnId = "fctxn_test_7";
      jest.spyOn(storage, "getProcessedRoundUpTransaction").mockResolvedValue(undefined);
      jest.spyOn(storage, "getUser").mockResolvedValue({
        id: userId,
        roundUpEnabled: true,
        roundUpProjectIds: [projectId],
      } as User);
      const processFundingSpy = jest
        .spyOn(projectService, "processFunding")
        .mockResolvedValue({} as never);

      const result = await processTransaction(txnId, -100, userId);

      expect(result.processed).toBe(false);
      expect(result.roundUpCents).toBe(0);
      expect(processFundingSpy).not.toHaveBeenCalled();
    });

    it("uses selectedRoundUpProject when roundUpProjectIds is empty", async () => {
      const txnId = "fctxn_test_8";
      jest.spyOn(storage, "getProcessedRoundUpTransaction").mockResolvedValue(undefined);
      jest.spyOn(storage, "getUser").mockResolvedValue({
        id: userId,
        roundUpEnabled: true,
        roundUpProjectIds: [],
        selectedRoundUpProject: projectId,
      } as User);
      jest.spyOn(storage, "addRoundUpBalance").mockResolvedValue(63);
      const processFundingSpy = jest
        .spyOn(projectService, "processFunding")
        .mockResolvedValue({} as never);
      jest.spyOn(storage, "createRoundUpTransaction").mockResolvedValue({} as never);

      const result = await processTransaction(txnId, -437, userId);

      expect(result.processed).toBe(true);
      expect(processFundingSpy).not.toHaveBeenCalled();
    });
  });

  describe("flushRoundUpBalances", () => {
    const projectId = "proj_123";
    const userId = "user_456";

    beforeEach(() => {
      jest.clearAllMocks();
      process.env.STRIPE_DISABLED = "false";
    });

    it("does not flush users with balance < $5 (e.g. $4.99)", async () => {
      jest.spyOn(storage, "getUsersWithRoundUpBalanceAbove").mockResolvedValue([]);

      const result = await flushRoundUpBalances();

      expect(result.flushed).toBe(0);
    });

    it("flushes users with balance >= $5 and donates to projects", async () => {
      jest.spyOn(storage, "getUsersWithRoundUpBalanceAbove").mockResolvedValue([
        {
          id: userId,
          roundUpEnabled: true,
          roundUpProjectIds: [projectId],
        } as User,
      ]);
      jest.spyOn(storage, "flushRoundUpBalance").mockResolvedValue({
        amountCents: 500,
        projectIds: [projectId],
      });
      jest.spyOn(projectService, "processFunding").mockResolvedValue({} as never);
      jest.spyOn(storage, "createRoundUpBatch").mockResolvedValue({} as never);

      const result = await flushRoundUpBalances();

      expect(result.flushed).toBe(1);
      expect(result.errors).toBe(0);
      expect(projectService.processFunding).toHaveBeenCalledWith(projectId, 5, userId);
      expect(storage.createRoundUpBatch).toHaveBeenCalledWith({
        userId,
        amountCents: 500,
        projectIds: [projectId],
      });
    });
  });
});
