import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import {
  USER_ROLES,
  ENVIRONMENTS,
  APPROVAL_STATUS,
  IMPACT_METRIC_TYPES,
  COMMENT_STATUS,
  SUPPORTED_CURRENCIES,
} from "../../shared/schema-mongo";

// ============================================
// Mongoose Schemas
// ============================================

const UserMongooseSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    fullName: { type: String },
    email: { type: String },
    phoneNumber: { type: String },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.user,
      index: true,
    },
    points: { type: Number, default: 0 },
    lastLogin: { type: Date },
    treeGrowth: { type: Number, default: 0 },
    sunwaterCoins: { type: Number, default: 0 },
    allowedEnvironment: {
      type: String,
      enum: Object.values(ENVIRONMENTS),
      default: ENVIRONMENTS.sandbox,
      index: true,
    },
    roundUpEnabled: { type: Boolean, default: false },
    selectedRoundUpProject: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    roundUpProjectIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Project" }],
    stripeCustomerId: { type: String, index: true },
    roundUpBalanceCents: { type: Number, default: 0 },
    preferredCurrency: {
      type: String,
      enum: SUPPORTED_CURRENCIES,
      required: false,
    },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    otpCode: { type: String },
    otpExpiresAt: { type: Date },
  },
  { timestamps: true },
);

// Pre-save hook to hash password using bcryptjs
UserMongooseSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password as string, salt);
});

const OrganizationMongooseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    description: { type: String, required: true },
    website: { type: String },
  },
  { timestamps: true },
);

const ProjectMongooseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, index: true },
    description: { type: String, required: true },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      address: { type: String, required: true },
    },
    imageUrl: { type: String, required: true },
    targetFunding: { type: Number, required: false },
    currentFunding: { type: Number, default: 0 },
    progress: { type: Number, default: 0 },
    status: { type: String, required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    approvalStatus: {
      type: String,
      enum: Object.values(APPROVAL_STATUS),
      default: APPROVAL_STATUS.pending,
      index: true,
    },
    allowedEnvironments: [
      {
        type: String,
        enum: Object.values(ENVIRONMENTS),
        index: true,
      },
    ],
    proposal: {
      objectives: { type: String, required: true },
      methodology: { type: String, required: true },
      timeline: [
        {
          phase: { type: String, required: true },
          duration: { type: String, required: true },
          deliverables: { type: String, required: true },
        },
      ],
      fundingBreakdown: [
        {
          category: { type: String, required: true },
          amount: { type: Number, required: true },
          description: { type: String, required: true },
        },
      ],
      measurableImpact: {
        metric: { type: String, required: true },
        targetValue: { type: Number, required: true },
        trackingMethod: { type: String, required: true },
      },
      supportingDocuments: [
        {
          name: { type: String, required: true },
          url: { type: String, required: true },
          type: { type: String, required: true },
        },
      ],
      impactTrackingProofUrl: { type: String },
    },
    impactMetrics: {
      type: {
        type: String,
        enum: Object.values(IMPACT_METRIC_TYPES),
      },
      unit: { type: String },
      targetAmount: { type: Number },
      currentAmount: { type: Number, default: 0 },
      perDollar: { type: Number },
    },
  },
  { timestamps: true },
);

// Compound index for environment-specific approved projects
ProjectMongooseSchema.index({ approvalStatus: 1, allowedEnvironments: 1, createdAt: -1 });

const ContributionMongooseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    projectTitle: { type: String, required: true },
    amount: { type: Number, required: true },
    impactMetrics: {
      trees: { type: Number },
      carbon: { type: Number },
    },
  },
  { timestamps: true },
);

const CommentMongooseSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    username: { type: String, required: true },
    content: { type: String, required: true },
    parentCommentId: { type: mongoose.Schema.Types.ObjectId, ref: "Comment", index: true },
    likes: { type: Number, default: 0 },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    status: {
      type: String,
      enum: Object.values(COMMENT_STATUS),
      default: COMMENT_STATUS.active,
      index: true,
    },
    flagCount: { type: Number, default: 0 },
    flaggedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    moderatedAt: { type: Date },
    moderationReason: { type: String },
  },
  { timestamps: true },
);

// Compound index for project comments sorted by date
CommentMongooseSchema.index({ projectId: 1, status: 1, createdAt: -1 });

export const UserModel = mongoose.model("User", UserMongooseSchema);
export const OrganizationModel = mongoose.model("Organization", OrganizationMongooseSchema);
export const ProjectModel = mongoose.model("Project", ProjectMongooseSchema);
export const ContributionModel = mongoose.model("Contribution", ContributionMongooseSchema);
export const CommentModel = mongoose.model("Comment", CommentMongooseSchema);
export const CommentFlagModel = mongoose.model(
  "CommentFlag",
  new mongoose.Schema(
    {
      commentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment",
        required: true,
        index: true,
      },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
      reason: { type: String, required: true },
      details: { type: String },
    },
    { timestamps: true },
  ),
);

// Round-Up: Linked bank accounts (Stripe Financial Connections)
const LinkedBankAccountSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    stripeAccountId: { type: String, required: true, unique: true, index: true },
    displayName: { type: String },
    institutionName: { type: String },
    last4: { type: String },
    lastTransactionRefreshId: { type: String },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
  },
  { timestamps: true },
);
LinkedBankAccountSchema.index({ userId: 1 }); // Single-field index for queries by userId

// Round-Up: Processed transactions (deduplication)
const RoundUpTransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    stripeTransactionId: { type: String, required: true, unique: true, index: true },
    originalAmountCents: { type: Number, required: true },
    roundUpAmount: { type: Number, required: true },
    processedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
RoundUpTransactionSchema.index({ userId: 1, stripeTransactionId: 1 });

// Round-Up: Batch donations (when accumulated balance reaches $5)
const RoundUpBatchSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amountCents: { type: Number, required: true },
    projectIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Project" }],
    donatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
RoundUpBatchSchema.index({ userId: 1, donatedAt: -1 });

export const LinkedBankAccountModel = mongoose.model("LinkedBankAccount", LinkedBankAccountSchema);
export const RoundUpTransactionModel = mongoose.model(
  "RoundUpTransaction",
  RoundUpTransactionSchema,
);
export const RoundUpBatchModel = mongoose.model("RoundUpBatch", RoundUpBatchSchema);

// Feedback submissions
const FeedbackSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    username: { type: String },
    message: { type: String, required: true },
  },
  { timestamps: true },
);
FeedbackSchema.index({ createdAt: -1 });

export const FeedbackModel = mongoose.model("Feedback", FeedbackSchema);
