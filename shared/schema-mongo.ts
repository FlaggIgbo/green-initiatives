// Environment types - exported for reuse in validation
export const ENVIRONMENTS = {
  development: "development",
  sandbox: "sandbox",
  production: "production",
  test: "test",
} as const;
export type Environment = (typeof ENVIRONMENTS)[keyof typeof ENVIRONMENTS];

// User roles - exported for reuse in validation
export const USER_ROLES = {
  admin: "admin",
  user: "user",
  entity: "entity",
} as const;
export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

// Supported display currencies (amounts stored in USD)
export const SUPPORTED_CURRENCIES = ["USD", "MXN", "BRL"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

// Project approval statuses
export const APPROVAL_STATUS = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
} as const;
export type ApprovalStatus = (typeof APPROVAL_STATUS)[keyof typeof APPROVAL_STATUS];

// Impact metric types
export const IMPACT_METRIC_TYPES = {
  trees: "trees",
  carbon: "carbon",
  waste: "waste",
  water: "water",
} as const;
export type ImpactMetricType = (typeof IMPACT_METRIC_TYPES)[keyof typeof IMPACT_METRIC_TYPES];

// Comment status for moderation
export const COMMENT_STATUS = {
  active: "active",
  hidden: "hidden", // Hidden by admin/moderator
  deleted: "deleted", // Soft deleted by user
  flagged: "flagged", // Flagged for review
} as const;
export type CommentStatus = (typeof COMMENT_STATUS)[keyof typeof COMMENT_STATUS];

// ============================================
// TypeScript Interfaces
// ============================================

export interface User {
  id: string;
  username: string;
  password?: string;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  role: UserRole;
  points: number;
  lastLogin?: Date;
  treeGrowth: number;
  sunwaterCoins: number;
  allowedEnvironment: Environment;
  roundUpEnabled: boolean;
  selectedRoundUpProject?: string;
  /** Project IDs to split round-up donations across (replaces single selectedRoundUpProject when set) */
  roundUpProjectIds?: string[];
  /** Stripe Customer ID for Financial Connections (bank linking) */
  stripeCustomerId?: string;
  /** Accumulated round-up amount in cents (Acorns-style: donate when >= $5) */
  roundUpBalanceCents?: number;
  /** Preferred currency for display (USD, MXN, BRL); amounts stored in USD */
  preferredCurrency?: Currency;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  otpCode?: string;
  otpExpiresAt?: Date;
  organizationId?: string;
  createdAt: Date;
}

export interface InsertUser {
  username: string;
  password: string;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  role?: UserRole;
  allowedEnvironment?: Environment;
  organizationId?: string;
}

export interface Organization {
  id: string;
  name: string;
  description: string;
  website?: string | null;
  createdAt?: Date;
}

export interface InsertOrganization {
  name: string;
  description: string;
  website?: string;
}

export interface TimelinePhase {
  phase: string;
  duration: string;
  deliverables: string;
}

export interface FundingBreakdown {
  category: string;
  amount: number;
  description: string;
}

export interface MeasurableImpact {
  metric: string;
  targetValue: number;
  trackingMethod: string;
}

export interface SupportingDocument {
  name: string;
  url: string;
  type: string;
}

export interface Proposal {
  objectives: string;
  methodology: string;
  timeline: TimelinePhase[];
  fundingBreakdown: FundingBreakdown[];
  measurableImpact: MeasurableImpact;
  supportingDocuments?: SupportingDocument[];
  impactTrackingProofUrl?: string;
}

export interface ProjectImpactMetrics {
  type: ImpactMetricType;
  unit: string;
  targetAmount: number;
  currentAmount: number;
  perDollar: number;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  organizationId: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  imageUrl: string;
  targetFunding?: number;
  currentFunding: number;
  progress: number;
  status: string;
  createdBy: string;
  approvalStatus: ApprovalStatus;
  createdAt: Date;
  updatedAt?: Date;
  allowedEnvironments: Environment[];
  proposal: Proposal;
  impactMetrics?: ProjectImpactMetrics;
}

export interface InsertProject {
  title: string;
  description: string;
  organizationId: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  imageUrl: string;
  targetFunding?: number;
  status: string;
  allowedEnvironments?: Environment[];
  proposal: Proposal;
  impactMetrics?: ProjectImpactMetrics;
}

export interface UpdateProject {
  title?: string;
  description?: string;
  location?: {
    lat: number;
    lng: number;
    address: string;
  };
  imageUrl?: string;
  targetFunding?: number;
  status?: string;
  progress?: number;
  proposal?: Proposal;
  impactMetrics?: ProjectImpactMetrics;
}

export interface Contribution {
  id: string;
  userId: string;
  projectId: string;
  projectTitle: string;
  amount: number;
  createdAt: Date;
  impactMetrics?: {
    trees?: number;
    carbon?: number;
  };
}

export interface InsertContribution {
  userId: string;
  projectId: string;
  projectTitle: string;
  amount: number;
}

export interface Comment {
  id: string;
  projectId: string;
  userId: string;
  username: string;
  content: string;
  parentCommentId?: string | null;
  createdAt: Date;
  updatedAt?: Date;
  likes: number;
  likedBy: string[];
  status: CommentStatus;
  flagCount: number;
  flaggedBy: string[];
  moderatedBy?: string;
  moderatedAt?: Date;
  moderationReason?: string;
}

export interface InsertComment {
  projectId: string;
  content: string;
  parentCommentId?: string | null;
}

export interface UpdateComment {
  content: string;
}

export interface FlagComment {
  reason: "spam" | "harassment" | "inappropriate" | "misinformation" | "other";
  details?: string;
}

// ============================================
// Round-Up / Bank Linking
// ============================================

/** Linked bank account via Stripe Financial Connections */
export interface LinkedBankAccount {
  id: string;
  userId: string;
  /** Stripe Financial Connections account ID (fca_xxx) */
  stripeAccountId: string;
  /** Display name from bank (e.g. "Checking", "Savings") */
  displayName?: string;
  institutionName?: string;
  /** Last 4 digits of account number (for display, e.g. "•••• 6789") */
  last4?: string;
  /** Last transaction_refresh ID we processed (for incremental sync) */
  lastTransactionRefreshId?: string;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt?: Date;
}

export interface InsertLinkedBankAccount {
  userId: string;
  stripeAccountId: string;
  displayName?: string;
  institutionName?: string;
  last4?: string;
}

/** Record of a batch donation when accumulated round-up reaches threshold ($5) */
export interface RoundUpBatch {
  id: string;
  userId: string;
  amountCents: number;
  projectIds: string[];
  donatedAt: Date;
}

/** Tracks which transactions we've already processed for round-up (avoid duplicates) */
export interface RoundUpTransaction {
  id: string;
  userId: string;
  /** Stripe Financial Connections transaction ID (fctxn_xxx) */
  stripeTransactionId: string;
  /** Original transaction amount in cents (negative = debit) */
  originalAmountCents: number;
  /** Round-up amount in dollars donated */
  roundUpAmount: number;
  /** When we processed this transaction */
  processedAt: Date;
}

export interface InsertRoundUpTransaction {
  userId: string;
  stripeTransactionId: string;
  originalAmountCents: number;
  roundUpAmount: number;
}

// ============================================
// Feedback
// ============================================
// TODO: Support deletion when feedback is old or marked as read to prevent unbounded table growth.

export interface Feedback {
  id: string;
  userId: string;
  username?: string;
  message: string;
  createdAt: Date;
}

export interface InsertFeedback {
  userId: string;
  username?: string;
  message: string;
}
