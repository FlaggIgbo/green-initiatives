import mongoose from "mongoose";
import {
  type User,
  type InsertUser,
  type Organization,
  type InsertOrganization,
  type Project,
  type InsertProject,
  type UpdateProject,
  type Contribution,
  type Comment,
  type InsertComment,
  type UpdateComment,
  type LinkedBankAccount,
  type InsertLinkedBankAccount,
  type RoundUpTransaction,
  type InsertRoundUpTransaction,
  type RoundUpBatch,
  USER_ROLES,
  APPROVAL_STATUS,
  ENVIRONMENTS,
  COMMENT_STATUS,
  type Environment,
} from "@shared/schema-mongo";
import {
  UserModel,
  OrganizationModel,
  ProjectModel,
  ContributionModel,
  CommentModel,
  CommentFlagModel,
  LinkedBankAccountModel,
  RoundUpTransactionModel,
  RoundUpBatchModel,
} from "../models";
import { logger } from "../logger";
import {
  DAILY_LOGIN_POINTS,
  MILLISECONDS_IN_DAY,
  STREAK_BONUS_POINTS,
  TREES_PER_DOLLAR,
  CARBON_PER_DOLLAR,
} from "../constants";

// Helper to convert Mongoose doc to plain object with id string
export function transformDoc<T>(doc: mongoose.Document | Record<string, unknown> | null): T {
  if (!doc) return doc as T;
  const obj = "toObject" in doc && typeof doc.toObject === "function" ? doc.toObject() : doc;

  // Convert _id to id string
  if (obj._id) {
    (obj as Record<string, unknown>).id = obj._id.toString();
    delete (obj as Record<string, unknown>)._id;
  }

  // Recursively convert all ObjectIds to strings for consistency in the frontend
  const convertObjectIds = (item: Record<string, unknown>) => {
    if (!item || typeof item !== "object") return;

    for (const key in item) {
      if (item[key] instanceof mongoose.Types.ObjectId) {
        item[key] = item[key].toString();
      } else if (Array.isArray(item[key])) {
        item[key] = (item[key] as unknown[]).map((val: unknown) => {
          if (val instanceof mongoose.Types.ObjectId) return val.toString();
          if (typeof val === "object" && val !== null)
            convertObjectIds(val as Record<string, unknown>);
          return val;
        });
      } else if (typeof item[key] === "object" && item[key] !== null) {
        convertObjectIds(item[key] as Record<string, unknown>);
      }
    }
  };

  convertObjectIds(obj as Record<string, unknown>);
  delete (obj as Record<string, unknown>).__v;
  return obj as T;
}

export class MongoStorage {
  // Users
  async getUser(id: string, environment?: Environment): Promise<User | undefined> {
    const user = await UserModel.findById(id).where(
      environment ? { allowedEnvironment: environment } : {},
    );
    return user ? transformDoc<User>(user) : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const user = await UserModel.findOne({ username });
    return user ? transformDoc<User>(user) : undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const user = await UserModel.findOne({ email });
    return user ? transformDoc<User>(user) : undefined;
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const user = await UserModel.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });
    return user ? transformDoc<User>(user) : undefined;
  }

  async getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | undefined> {
    const user = await UserModel.findOne({ stripeCustomerId });
    return user ? transformDoc<User>(user) : undefined;
  }

  async setResetToken(userId: string, token: string, expires: Date): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, {
      resetPasswordToken: token,
      resetPasswordExpires: expires,
    });
  }

  async resetPassword(userId: string, passwordHash: string): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, {
      $set: { password: passwordHash },
      $unset: { resetPasswordToken: 1, resetPasswordExpires: 1 },
    });
  }

  async setOTP(userId: string, otp: string, expires: Date): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, {
      otpCode: otp,
      otpExpiresAt: expires,
    });
  }

  async getUserByOTP(userId: string, otp: string): Promise<User | undefined> {
    const user = await UserModel.findOne({
      _id: userId,
      otpCode: otp,
      otpExpiresAt: { $gt: new Date() },
    });
    return user ? transformDoc<User>(user) : undefined;
  }

  async clearOTP(userId: string): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, {
      $unset: { otpCode: 1, otpExpiresAt: 1 },
    });
  }

  async createUser(user: InsertUser, currentEnvironment?: Environment): Promise<User> {
    const newUser = new UserModel({
      ...user,
      role: user.role || USER_ROLES.user,
      points: DAILY_LOGIN_POINTS,
      lastLogin: new Date(),
      treeGrowth: 0,
      sunwaterCoins: Math.floor(DAILY_LOGIN_POINTS / 2),
      allowedEnvironment: user.allowedEnvironment || currentEnvironment || ENVIRONMENTS.sandbox,
      roundUpEnabled: false,
    });
    await newUser.save();
    return transformDoc<User>(newUser);
  }

  async updateUserLoginStreak(userId: string): Promise<User> {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error("User not found");

    const now = new Date();
    const lastLogin = user.lastLogin ? new Date(user.lastLogin) : new Date(0);
    const msSinceLastLogin = now.getTime() - lastLogin.getTime();
    const daysSinceLastLogin = Math.floor(msSinceLastLogin / MILLISECONDS_IN_DAY);

    let pointsToAdd = 0;

    // Only award points if it's been at least 24 hours since the last login
    if (msSinceLastLogin >= MILLISECONDS_IN_DAY || !user.lastLogin) {
      pointsToAdd = DAILY_LOGIN_POINTS;
      if (daysSinceLastLogin === 1) {
        pointsToAdd += STREAK_BONUS_POINTS;
      }
    }

    if (pointsToAdd > 0) {
      user.points = (user.points || 0) + pointsToAdd;
      user.sunwaterCoins = (user.sunwaterCoins || 0) + Math.floor(pointsToAdd / 2);
    }

    user.lastLogin = now;
    await user.save();

    return transformDoc<User>(user);
  }

  async updateUserPoints(userId: string, points: number): Promise<User> {
    // TODO: Implement badge achievement logic
    // Check if points threshold reached for new levels
    // Award specific badges (e.g., "First Donation", "Eco Warrior")
    const user = await UserModel.findByIdAndUpdate(
      userId,
      {
        $inc: {
          points: points,
          sunwaterCoins: Math.floor(points / 2),
        },
      },
      { new: true },
    );
    if (!user) throw new Error("User not found");
    return transformDoc<User>(user);
  }

  async updateTreeGrowth(userId: string, growth: number): Promise<User> {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error("User not found");

    const newGrowth = Math.min(100, Math.max(0, (user.treeGrowth || 0) + growth));
    user.treeGrowth = newGrowth;
    await user.save();

    return transformDoc<User>(user);
  }

  async updateSunwaterCoins(userId: string, coins: number): Promise<User> {
    const user = await UserModel.findByIdAndUpdate(
      userId,
      { $inc: { sunwaterCoins: coins } },
      { new: true },
    );
    if (!user) throw new Error("User not found");
    return transformDoc<User>(user);
  }

  // Organizations
  async getOrganization(id: string): Promise<Organization | undefined> {
    const org = await OrganizationModel.findById(id);
    return org ? transformDoc<Organization>(org) : undefined;
  }

  async getOrganizations(): Promise<Organization[]> {
    const orgs = await OrganizationModel.find();
    return orgs.map((org) => transformDoc<Organization>(org));
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const newOrg = new OrganizationModel({
      ...org,
      website: org.website || null,
    });
    await newOrg.save();
    return transformDoc<Organization>(newOrg);
  }

  // Projects
  async getProject(id: string, environment?: Environment): Promise<Project | undefined> {
    const query: Record<string, unknown> = { _id: id };
    if (environment) {
      query.allowedEnvironments = environment;
    }
    const project = await ProjectModel.findOne(query);
    return project ? transformDoc<Project>(project) : undefined;
  }

  async getProjects(): Promise<Project[]> {
    const projects = await ProjectModel.find();
    return projects.map((project) => transformDoc<Project>(project));
  }

  async getApprovedProjects(environment?: Environment): Promise<Project[]> {
    const filter: Record<string, unknown> = {
      approvalStatus: APPROVAL_STATUS.approved,
    };

    if (environment) {
      filter.allowedEnvironments = environment;
    }

    logger.debug(`[Storage] Fetching approved projects for environment: ${environment}`, {
      filter,
    });

    const projects = await ProjectModel.find(filter);
    logger.debug(`[Storage] Found ${projects.length} projects`);

    return projects.map((project) => transformDoc<Project>(project));
  }

  async getProjectsByCreator(creatorId: string, environment?: Environment): Promise<Project[]> {
    const filter: Record<string, unknown> = {
      createdBy: creatorId,
    };

    if (environment) {
      filter.allowedEnvironments = environment;
    }

    const projects = await ProjectModel.find(filter).sort({ createdAt: -1 });
    return projects.map((project) => transformDoc<Project>(project));
  }

  async getAllProjects(environment?: Environment): Promise<Project[]> {
    const filter: Record<string, unknown> = {};
    if (environment) {
      filter.allowedEnvironments = environment;
    }
    const projects = await ProjectModel.find(filter).sort({ createdAt: -1 });
    return projects.map((project) => transformDoc<Project>(project));
  }

  async createProject(project: InsertProject, currentEnvironment?: Environment): Promise<Project> {
    const newProject = new ProjectModel({
      ...project,
      currentFunding: 0,
      progress: 0,
      approvalStatus: APPROVAL_STATUS.pending,
      allowedEnvironments: project.allowedEnvironments || [
        currentEnvironment || ENVIRONMENTS.sandbox,
      ],
    });
    await newProject.save();
    return transformDoc<Project>(newProject);
  }

  async updateProject(id: string, updates: UpdateProject): Promise<Project> {
    const project = await ProjectModel.findByIdAndUpdate(
      id,
      {
        $set: updates,
      },
      { new: true },
    );
    if (!project) throw new Error("Project not found");
    return transformDoc<Project>(project);
  }

  async updateProjectApprovalStatus(
    id: string,
    status: "pending" | "approved" | "rejected",
  ): Promise<Project> {
    const project = await ProjectModel.findByIdAndUpdate(
      id,
      {
        $set: {
          approvalStatus: status,
        },
      },
      { new: true },
    );
    if (!project) throw new Error("Project not found");
    return transformDoc<Project>(project);
  }

  async updateProjectProgress(id: string, progress: number): Promise<Project> {
    const project = await ProjectModel.findByIdAndUpdate(id, { $set: { progress } }, { new: true });
    if (!project) throw new Error("Project not found");
    return transformDoc<Project>(project);
  }

  async updateProjectFunding(id: string, amount: number): Promise<Project> {
    const project = await ProjectModel.findByIdAndUpdate(
      id,
      { $inc: { currentFunding: amount } },
      { new: true },
    );
    if (!project) throw new Error("Project not found");
    return transformDoc<Project>(project);
  }

  // Contributions
  async recordUserContribution(
    userId: string,
    projectId: string,
    amount: number,
  ): Promise<Contribution> {
    const project = await ProjectModel.findById(projectId);
    if (!project) throw new Error("Project not found");

    let treeImpact = Math.floor(amount * TREES_PER_DOLLAR);
    let carbonImpact = Math.floor(amount * CARBON_PER_DOLLAR);

    if (project.impactMetrics) {
      const contributionImpact = amount * (project.impactMetrics.perDollar || 0);

      project.impactMetrics.currentAmount =
        (project.impactMetrics.currentAmount || 0) + contributionImpact;
      await project.save();

      if (project.impactMetrics.type === "trees") {
        treeImpact = Math.floor(contributionImpact);
      } else if (project.impactMetrics.type === "carbon") {
        carbonImpact = Math.floor(contributionImpact);
      }
    }

    const newContribution = new ContributionModel({
      userId,
      projectId,
      projectTitle: project.title,
      amount,
      impactMetrics: {
        trees: treeImpact,
        carbon: carbonImpact,
      },
    });

    await newContribution.save();
    return transformDoc<Contribution>(newContribution);
  }

  async getUserContributions(userId: string): Promise<Contribution[]> {
    const contributions = await ContributionModel.find({ userId }).sort({ createdAt: -1 });
    return contributions.map((c) => transformDoc<Contribution>(c));
  }

  // User Profile Management
  async updateRoundUpSettings(
    userId: string,
    enabled: boolean,
    projectId?: string,
    projectIds?: string[],
  ): Promise<User> {
    const updates: Record<string, unknown> = { roundUpEnabled: enabled };
    if (projectIds !== undefined) {
      updates.roundUpProjectIds = projectIds;
      updates.selectedRoundUpProject = projectIds?.length === 1 ? projectIds[0] : null;
    } else if (projectId !== undefined) {
      updates.selectedRoundUpProject = projectId || null;
      if (!projectId) updates.roundUpProjectIds = [];
    }
    const user = await UserModel.findByIdAndUpdate(userId, { $set: updates }, { new: true });
    if (!user) throw new Error("User not found");
    return transformDoc<User>(user);
  }

  async updatePreferredCurrency(userId: string, preferredCurrency: string): Promise<User> {
    const user = await UserModel.findByIdAndUpdate(
      userId,
      { $set: { preferredCurrency } },
      { new: true },
    );
    if (!user) throw new Error("User not found");
    return transformDoc<User>(user);
  }

  async setStripeCustomerId(userId: string, stripeCustomerId: string): Promise<User> {
    const user = await UserModel.findByIdAndUpdate(
      userId,
      { $set: { stripeCustomerId } },
      { new: true },
    );
    if (!user) throw new Error("User not found");
    return transformDoc<User>(user);
  }

  // Linked Bank Accounts
  async createLinkedBankAccount(data: InsertLinkedBankAccount): Promise<LinkedBankAccount> {
    const doc = new LinkedBankAccountModel({
      userId: data.userId,
      stripeAccountId: data.stripeAccountId,
      displayName: data.displayName,
      institutionName: data.institutionName,
      last4: data.last4,
      status: "active",
    });
    await doc.save();
    return transformDoc<LinkedBankAccount>(doc);
  }

  async getLinkedBankAccounts(userId: string): Promise<LinkedBankAccount[]> {
    const accounts = await LinkedBankAccountModel.find({ userId, status: "active" });
    return accounts.map((a) => transformDoc<LinkedBankAccount>(a));
  }

  async getLinkedBankAccountByStripeId(
    stripeAccountId: string,
  ): Promise<LinkedBankAccount | undefined> {
    const doc = await LinkedBankAccountModel.findOne({ stripeAccountId });
    return doc ? transformDoc<LinkedBankAccount>(doc) : undefined;
  }

  async updateLinkedBankAccountLastRefresh(
    stripeAccountId: string,
    lastTransactionRefreshId: string,
  ): Promise<void> {
    await LinkedBankAccountModel.updateOne(
      { stripeAccountId },
      { $set: { lastTransactionRefreshId } },
    );
  }

  async removeLinkedBankAccount(userId: string, stripeAccountId: string): Promise<void> {
    await LinkedBankAccountModel.updateOne(
      { userId, stripeAccountId },
      { $set: { status: "inactive" } },
    );
  }

  // Round-Up Transactions (deduplication)
  async getProcessedRoundUpTransaction(
    stripeTransactionId: string,
  ): Promise<RoundUpTransaction | undefined> {
    const doc = await RoundUpTransactionModel.findOne({ stripeTransactionId });
    return doc ? transformDoc<RoundUpTransaction>(doc) : undefined;
  }

  async createRoundUpTransaction(data: InsertRoundUpTransaction): Promise<RoundUpTransaction> {
    const doc = new RoundUpTransactionModel(data);
    await doc.save();
    return transformDoc<RoundUpTransaction>(doc);
  }

  async getRoundUpTransactionsForUser(userId: string, limit = 10): Promise<RoundUpTransaction[]> {
    const docs = await RoundUpTransactionModel.find({ userId })
      .sort({ processedAt: -1 })
      .limit(limit)
      .lean();
    return docs.map((d) => transformDoc<RoundUpTransaction>(d as never));
  }

  async addRoundUpBalance(userId: string, cents: number): Promise<number> {
    const result = await UserModel.findByIdAndUpdate(
      userId,
      { $inc: { roundUpBalanceCents: cents } },
      { new: true },
    );
    return result?.roundUpBalanceCents ?? cents;
  }

  async getUsersWithRoundUpBalanceAbove(thresholdCents: number): Promise<User[]> {
    const docs = await UserModel.find({
      roundUpEnabled: true,
      roundUpBalanceCents: { $gte: thresholdCents },
    }).lean();
    return docs.map((d) => transformDoc<User>(d as never));
  }

  /** Flush when balance >= thresholdCents ($5 = 500). Returns null if below threshold. Caller must verify user has projects. */
  async flushRoundUpBalance(
    userId: string,
    thresholdCents = 500,
  ): Promise<{ amountCents: number; projectIds: string[] } | null> {
    const user = await UserModel.findOneAndUpdate(
      { _id: userId, roundUpBalanceCents: { $gte: thresholdCents } },
      { $set: { roundUpBalanceCents: 0 } },
      { new: false },
    );
    if (!user || (user.roundUpBalanceCents ?? 0) < thresholdCents) return null;
    const amountCents = user.roundUpBalanceCents ?? 0;
    const projectIds =
      user.roundUpProjectIds?.length > 0
        ? user.roundUpProjectIds.map((id) => id.toString())
        : user.selectedRoundUpProject
          ? [user.selectedRoundUpProject.toString()]
          : [];
    if (projectIds.length === 0) {
      // Restore balance - we can't donate without projects
      await UserModel.findByIdAndUpdate(userId, { $inc: { roundUpBalanceCents: amountCents } });
      return null;
    }
    return { amountCents, projectIds };
  }

  async createRoundUpBatch(data: {
    userId: string;
    amountCents: number;
    projectIds: string[];
  }): Promise<RoundUpBatch> {
    const doc = new RoundUpBatchModel({
      userId: data.userId,
      amountCents: data.amountCents,
      projectIds: data.projectIds,
    });
    await doc.save();
    return transformDoc<RoundUpBatch>(doc);
  }

  async getRoundUpBatchesForUser(userId: string, limit = 5): Promise<RoundUpBatch[]> {
    const docs = await RoundUpBatchModel.find({ userId })
      .sort({ donatedAt: -1 })
      .limit(limit)
      .lean();
    return docs.map((d) => transformDoc<RoundUpBatch>(d as never));
  }

  // Comments
  async getProjectComments(projectId: string, includeHidden = false): Promise<Comment[]> {
    const filter: Record<string, unknown> = { projectId };
    if (!includeHidden) {
      filter.status = { $nin: [COMMENT_STATUS.deleted, COMMENT_STATUS.hidden] };
    }
    const comments = await CommentModel.find(filter).sort({ createdAt: -1 });
    return comments.map((c) => transformDoc<Comment>(c));
  }

  async getComment(commentId: string): Promise<Comment | undefined> {
    const comment = await CommentModel.findById(commentId);
    return comment ? transformDoc<Comment>(comment) : undefined;
  }

  async createComment(comment: InsertComment, userId: string, username: string): Promise<Comment> {
    const newComment = new CommentModel({
      projectId: comment.projectId,
      userId,
      username,
      content: comment.content,
      parentCommentId: comment.parentCommentId || null,
      likes: 0,
      likedBy: [],
      status: COMMENT_STATUS.active,
      flagCount: 0,
      flaggedBy: [],
    });
    await newComment.save();
    return transformDoc<Comment>(newComment);
  }

  async updateComment(commentId: string, updates: UpdateComment): Promise<Comment> {
    const comment = await CommentModel.findByIdAndUpdate(
      commentId,
      {
        $set: {
          content: updates.content,
        },
      },
      { new: true },
    );
    if (!comment) throw new Error("Comment not found");
    return transformDoc<Comment>(comment);
  }

  async deleteComment(commentId: string): Promise<void> {
    await CommentModel.findByIdAndUpdate(commentId, {
      $set: {
        status: COMMENT_STATUS.deleted,
      },
    });
  }

  async toggleCommentLike(commentId: string, userId: string): Promise<Comment> {
    const comment = await CommentModel.findById(commentId);
    if (!comment) throw new Error("Comment not found");

    const likedBy = (comment.likedBy || []).map((id) => id.toString());
    const hasLiked = likedBy.includes(userId);

    if (hasLiked) {
      comment.likedBy = likedBy
        .filter((id: string) => id !== userId)
        .map((id: string) => new mongoose.Types.ObjectId(id));
      comment.likes = Math.max(0, (comment.likes || 0) - 1);
    } else {
      comment.likedBy.push(new mongoose.Types.ObjectId(userId));
      comment.likes = (comment.likes || 0) + 1;
    }

    await comment.save();
    return transformDoc<Comment>(comment);
  }

  async flagComment(
    commentId: string,
    userId: string,
    reason: string,
    details?: string,
  ): Promise<Comment> {
    const comment = await CommentModel.findById(commentId);
    if (!comment) throw new Error("Comment not found");

    const flaggedBy = (comment.flaggedBy || []).map((id) => id.toString());
    if (flaggedBy.includes(userId)) {
      throw new Error("You have already flagged this comment");
    }

    comment.flaggedBy.push(new mongoose.Types.ObjectId(userId));
    comment.flagCount = (comment.flagCount || 0) + 1;
    if (comment.flagCount >= 3) {
      comment.status = COMMENT_STATUS.flagged;
    }

    await comment.save();

    const flag = new CommentFlagModel({
      commentId: new mongoose.Types.ObjectId(commentId),
      userId: new mongoose.Types.ObjectId(userId),
      reason,
      details: details || null,
    });
    await flag.save();

    return transformDoc<Comment>(comment);
  }

  async moderateComment(
    commentId: string,
    adminId: string,
    action: "hide" | "unhide" | "delete",
    reason?: string,
  ): Promise<Comment> {
    const statusMap = {
      hide: COMMENT_STATUS.hidden,
      unhide: COMMENT_STATUS.active,
      delete: COMMENT_STATUS.deleted,
    };

    const comment = await CommentModel.findByIdAndUpdate(
      commentId,
      {
        $set: {
          status: statusMap[action],
          moderatedBy: adminId,
          moderatedAt: new Date(),
          moderationReason: reason || null,
        },
      },
      { new: true },
    );
    if (!comment) throw new Error("Comment not found");
    return transformDoc<Comment>(comment);
  }

  async getFlaggedComments(): Promise<Comment[]> {
    const comments = await CommentModel.find({ flagCount: { $gt: 0 } }).sort({
      flagCount: -1,
      createdAt: -1,
    });
    return comments.map((c) => transformDoc<Comment>(c));
  }

  async getProjectCommentCount(projectId: string): Promise<number> {
    return CommentModel.countDocuments({
      projectId,
      status: { $nin: [COMMENT_STATUS.deleted, COMMENT_STATUS.hidden] },
    });
  }
}

export const storage = new MongoStorage();
