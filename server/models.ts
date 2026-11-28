import mongoose, { Schema } from "mongoose";

const PasskeySubSchema = new Schema(
  {
    credentialId: { type: String, required: true },
    publicKeySpki: { type: String, required: true },
    algorithm: { type: Number, default: -7 },
    signCount: { type: Number, default: 0 },
    transports: { type: [String], default: [] },
    label: { type: String, default: "Passkey" },
    createdAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date },
  },
  { _id: false },
);

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    roundUpEnabled: { type: Boolean, default: true },
    selectedBasketId: { type: String, default: "clean-energy-grid" },
    roundUpBalanceCents: { type: Number, default: 0 },
    passkeys: { type: [PasskeySubSchema], default: [] },
    pendingChallenge: {
      challenge: { type: String },
      type: { type: String, enum: ["registration", "authentication"] },
      expiresAt: { type: Date },
    },
    // TODO: Add givingRule subdocument (enabled, percentageBps, eligibleCategories, directCharitySplitPct, dafSplitPct, selectedCharityEin)
    // TODO: Add givingBalanceCents, dafAccountId, dafSponsorEin, and achAuthorizedAt (NACHA consent audit)
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

// TODO: Populate and query DonationLedgerModel during ACH pull, settlement webhook, and tax-doc generation
const DonationLedgerSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    idempotencyKey: { type: String, required: true, unique: true },
    achTransferId: { type: String, index: true },
    destinationType: { type: String, enum: ["DIRECT_501C3", "DAF"], required: true },
    recipientEin: { type: String, required: true },
    recipientName: { type: String, required: true },
    amountCents: { type: Number, required: true },
    status: {
      type: String,
      enum: ["ACCRUED", "ACH_PENDING", "ACH_SETTLED", "DISBURSED", "FAILED", "RETURNED"],
      required: true,
    },
    settledAt: { type: Date },
    receiptUrl: { type: String },
  },
  { timestamps: true },
);

// TODO: Archive generated annual Schedule A / IRC § 170(f)(8) tax document packets
const TaxDocumentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    taxYear: { type: Number, required: true },
    format: { type: String, enum: ["pdf", "csv"], required: true },
    totalDeductibleCents: { type: Number, required: true },
    storageKey: { type: String },
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
export const DonationLedgerModel =
  mongoose.models.DonationLedger || mongoose.model("DonationLedger", DonationLedgerSchema);
export const TaxDocumentModel =
  mongoose.models.TaxDocument || mongoose.model("TaxDocument", TaxDocumentSchema);
