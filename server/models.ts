import mongoose, { Schema } from "mongoose";

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    roundUpEnabled: { type: Boolean, default: true },
    selectedBasketId: { type: String, default: "clean-energy-grid" },
    roundUpBalanceCents: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const LinkedAccountSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    plaidItemId: { type: String, required: true },
    plaidAccountId: { type: String, required: true },
    // TODO: Encrypt accessToken at rest before storing in production (AES-256-GCM / KMS)
    accessToken: { type: String, required: true },
    syncCursor: { type: String, default: "" },
    institutionName: { type: String, required: true },
    accountName: { type: String, required: true },
    mask: { type: String, default: "0000" },
  },
  { timestamps: true },
);

const RoundUpTransactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    plaidTransactionId: { type: String, required: true, unique: true },
    merchantName: { type: String, required: true },
    amountCents: { type: Number, required: true },
    roundUpCents: { type: Number, required: true },
    date: { type: String, required: true },
  },
  { timestamps: true },
);

const LedgerEntrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    idempotencyKey: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["ACCRUED", "PENDING_SETTLEMENT", "INVESTED", "FAILED"],
      required: true,
    },
    amountCents: { type: Number, required: true },
    basketId: { type: String, required: true },
    brokerOrderIds: { type: [String], default: [] },
  },
  { timestamps: true },
);

export const UserModel = mongoose.models.User || mongoose.model("User", UserSchema);
export const LinkedAccountModel =
  mongoose.models.LinkedAccount || mongoose.model("LinkedAccount", LinkedAccountSchema);
export const RoundUpTransactionModel =
  mongoose.models.RoundUpTransaction ||
  mongoose.model("RoundUpTransaction", RoundUpTransactionSchema);
export const LedgerEntryModel =
  mongoose.models.LedgerEntry || mongoose.model("LedgerEntry", LedgerEntrySchema);
