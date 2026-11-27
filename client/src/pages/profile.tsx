import { useState, useEffect, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { getContributions, updateRoundupSettings } from "../features/auth/authSlice";
import { getProjects, selectAllProjects } from "../features/projects/projectSlice";
import { useTranslation } from "@/hooks/use-translation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import {
  User,
  Leaf,
  TrendingUp,
  DollarSign,
  CreditCard,
  TreePine,
  Droplet,
  Heart,
  Award,
  Calendar,
  Target,
  BarChart3,
  Settings,
  Landmark,
  ChevronRight,
} from "lucide-react";
import {
  getLinkedAccounts,
  getRecentRoundUpTransactions,
  getRoundUpSummary,
} from "../features/roundup/roundupService";
import { useCurrency } from "@/hooks/use-currency";
import { ContributionChart } from "@/components/dashboard/contribution-chart";
import type { RootState, AppDispatch } from "../app/store";
import type { LinkedBankAccount, RoundUpTransaction } from "@shared/schema-mongo";

export default function Profile() {
  const navigate = useNavigate();
  const {
    user,
    contributions,
    isLoading: authLoading,
  } = useSelector((state: RootState) => state.auth);
  const projects = useSelector(selectAllProjects);
  const { isLoading: projectsLoading, isError: _projectsError } = useSelector(
    (state: RootState) => state.project,
  );
  const { t } = useTranslation();
  const { formatCurrency, formatCents } = useCurrency();
  const dispatch = useDispatch<AppDispatch>();
  const [roundUpEnabled, setRoundUpEnabled] = useState(user?.roundUpEnabled || false);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedBankAccount[]>([]);
  const [recentRoundUps, setRecentRoundUps] = useState<RoundUpTransaction[]>([]);
  const [roundUpBalanceCents, setRoundUpBalanceCents] = useState(0);
  const [recentBatches, setRecentBatches] = useState<{ amountCents: number; donatedAt: Date }[]>(
    [],
  );

  useEffect(() => {
    if (user) {
      dispatch(getContributions());
      dispatch(getProjects());
      getLinkedAccounts()
        .then(setLinkedAccounts)
        .catch(() => setLinkedAccounts([]));
    }
  }, [user, dispatch]);

  useEffect(() => {
    if (user && roundUpEnabled && linkedAccounts.length > 0) {
      getRecentRoundUpTransactions(5)
        .then(setRecentRoundUps)
        .catch(() => setRecentRoundUps([]));
      getRoundUpSummary()
        .then((s) => {
          setRoundUpBalanceCents(s.balanceCents);
          setRecentBatches(
            s.batches.map((b) => ({
              amountCents: b.amountCents,
              donatedAt: new Date(b.donatedAt),
            })),
          );
        })
        .catch(() => {
          setRoundUpBalanceCents(0);
          setRecentBatches([]);
        });
    } else {
      setRecentRoundUps([]);
      setRoundUpBalanceCents(0);
      setRecentBatches([]);
    }
  }, [user, roundUpEnabled, linkedAccounts.length]);

  useEffect(() => {
    if (user) {
      setRoundUpEnabled(user.roundUpEnabled);
    }
  }, [user]);

  // Handle round-up toggle
  const handleRoundUpToggle = async (enabled: boolean) => {
    setRoundUpEnabled(enabled);
    try {
      await dispatch(updateRoundupSettings(enabled)).unwrap();
    } catch (error) {
      console.error("Failed to update round-up settings:", error);
    }
  };

  // Calculate environmental impact (memoized to avoid re-calculation on every render)
  const impactData = useMemo(() => {
    if (!user) return null;

    const totalContributions = contributions.reduce((sum, c) => sum + c.amount, 0);
    const contributionCount = contributions.length;
    const treeProgress = user.treeGrowth || 0;
    const sunwaterCoins = user.sunwaterCoins || 0;

    // Calculate sustainability score (0-100)
    const sustainabilityScore = Math.min(
      100,
      Math.round((contributionCount * 10 + treeProgress) / 2),
    );

    return {
      totalContributions,
      contributionCount,
      treeProgress,
      sunwaterCoins,
      sustainabilityScore,
    };
  }, [user, contributions]);

  if (!user || projectsLoading || authLoading || !impactData) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-24" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/4 mb-2" />
            <Skeleton className="h-4 w-1/3" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-6 w-24" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const {
    totalContributions,
    contributionCount,
    treeProgress,
    sunwaterCoins,
    sustainabilityScore,
  } = impactData;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <User className="h-8 w-8" />
            {t.profile?.title || "My Profile"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t.profile?.subtitle || "Manage your account and track your environmental impact"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-lg px-4 py-2 hidden sm:flex">
            {user.role === "entity"
              ? t.accountType.partner
              : user.role === "admin"
                ? t.accountType.admin
                : t.accountType.member}
          </Badge>
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/settings")}
            title={t.navigation?.settings || "Settings"}
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Account Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Account Information
          </CardTitle>
          <CardDescription>Your basic account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="text-left">
              <p className="text-sm text-muted-foreground">Username</p>
              <p className="font-medium">{user.username}</p>
            </div>
            <div className="md:text-right text-left">
              <p className="text-sm text-muted-foreground">Account Type</p>
              <p className="font-medium capitalize">{user.role}</p>
            </div>
            <div className="text-left">
              <p className="text-sm text-muted-foreground">Member Since</p>
              <p className="font-medium">
                {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}
              </p>
            </div>
            <div className="md:text-right text-left">
              <p className="text-sm text-muted-foreground">Points Earned</p>
              <p className="font-medium flex items-center gap-1 md:justify-end justify-start">
                <Award className="h-4 w-4 text-yellow-500" />
                {user.points || 0}
              </p>
            </div>
            <div className="text-left">
              <p className="text-sm text-muted-foreground">
                {t.profile?.accountStatus ?? "Account Status"}
              </p>
              <Badge
                variant="outline"
                className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30"
              >
                {t.profile?.accountActive ?? "Active"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sustainability Impact Dashboard - The Main Feature */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Environmental Contribution Summary */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Leaf className="h-5 w-5 text-green-600" />
              Environmental Impact Dashboard
            </CardTitle>
            <CardDescription>
              Track your contributions and see your direct impact on the environment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Total Contributions */}
              <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <Badge variant="secondary">{contributionCount}</Badge>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(totalContributions)}</p>
                <p className="text-sm text-muted-foreground">Total Donated</p>
              </div>

              {/* Sustainability Score */}
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Target className="h-5 w-5 text-blue-600" />
                  <Badge variant="secondary">{sustainabilityScore}/100</Badge>
                </div>
                <p className="text-2xl font-bold">{sustainabilityScore}%</p>
                <p className="text-sm text-muted-foreground">Sustainability Score</p>
              </div>

              {/* Tree Growth */}
              <div className="bg-emerald-50 dark:bg-emerald-950 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <TreePine className="h-5 w-5 text-emerald-600" />
                  <Badge variant="secondary">{treeProgress}%</Badge>
                </div>
                <p className="text-2xl font-bold">{treeProgress}%</p>
                <p className="text-sm text-muted-foreground">Tree Growth</p>
              </div>

              {/* Sunwater Coins */}
              <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Droplet className="h-5 w-5 text-amber-600" />
                  <Badge variant="secondary">{sunwaterCoins}</Badge>
                </div>
                <p className="text-2xl font-bold">{sunwaterCoins}</p>
                <p className="text-sm text-muted-foreground">Sunwater Coins</p>
              </div>
            </div>

            {/* Sustainability Progress */}
            <div className="space-y-3">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Sustainability Progress</span>
                  <span className="text-sm text-muted-foreground">{sustainabilityScore}%</span>
                </div>
                <Progress value={sustainabilityScore} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Tree Growth</span>
                  <span className="text-sm text-muted-foreground">{treeProgress}%</span>
                </div>
                <Progress value={treeProgress} className="h-2" />
              </div>
            </div>

            {/* Contributions Over Time Chart */}
            <div className="mt-6 pt-6 border-t">
              <h4 className="text-sm font-medium mb-3">
                {t.profile?.contributionTrend ?? "Contributions Over Time"}
              </h4>
              <ContributionChart
                contributions={contributions.map((c) => ({
                  amount: c.amount,
                  createdAt:
                    typeof c.createdAt === "string"
                      ? c.createdAt
                      : (c.createdAt as Date).toISOString(),
                }))}
                formatAmount={formatCurrency}
                emptyMessage={t.profile?.noContributions ?? "No contributions yet"}
              />
            </div>
          </CardContent>
        </Card>

        {/* Round-Up Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Round-Up Settings
            </CardTitle>
            <CardDescription>Automatically donate rounded-up purchase amounts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="roundup-toggle">Enable Round-Ups</Label>
                <p className="text-sm text-muted-foreground">Round purchases to nearest dollar</p>
              </div>
              <Switch
                id="roundup-toggle"
                checked={roundUpEnabled}
                onCheckedChange={handleRoundUpToggle}
              />
            </div>
            {roundUpEnabled && (
              <div className="bg-muted p-4 rounded-lg space-y-3">
                {linkedAccounts.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Linked bank accounts</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto py-1 px-2 text-muted-foreground hover:text-foreground"
                        onClick={() => navigate("/settings?tab=roundup")}
                      >
                        Manage
                        <ChevronRight className="h-4 w-4 ml-0.5" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {linkedAccounts.map((acc) => (
                        <div
                          key={acc.id}
                          className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                            <Landmark className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {acc.displayName || "Bank account"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {acc.institutionName || "Bank"}
                              {acc.last4 ? ` •••• ${acc.last4}` : ""}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {(roundUpBalanceCents > 0 || recentBatches.length > 0) && (
                      <div className="space-y-2 pt-2 border-t">
                        {roundUpBalanceCents > 0 && (
                          <p className="text-xs font-medium text-muted-foreground">
                            Accumulated: {formatCents(roundUpBalanceCents)} (donates at{" "}
                            {formatCurrency(5)})
                          </p>
                        )}
                        {recentBatches.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Last donation: {formatCents(recentBatches[0].amountCents)} on{" "}
                            {recentBatches[0].donatedAt.toLocaleDateString()}
                          </p>
                        )}
                        {recentRoundUps.length > 0 && (
                          <>
                            <p className="text-xs font-medium text-muted-foreground pt-1">
                              Recent round-ups
                            </p>
                            <div className="space-y-1.5">
                              {recentRoundUps.map((txn) => {
                                const purchaseAmt = Math.abs(txn.originalAmountCents) / 100;
                                return (
                                  <div
                                    key={txn.id}
                                    className="flex items-center justify-between text-sm"
                                  >
                                    <span className="text-muted-foreground">
                                      Purchase {formatCurrency(purchaseAmt)} →{" "}
                                      <span className="font-medium text-foreground">
                                        {formatCurrency(txn.roundUpAmount)} rounded up
                                      </span>
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(txn.processedAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium">Link your bank account</p>
                    <p className="text-sm text-muted-foreground">
                      Connect your bank via Stripe to round up purchases and donate spare change to
                      environmental projects.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => navigate("/settings?tab=roundup")}
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Link Bank Account
                    </Button>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Financial Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Financial Activity
            </CardTitle>
            <CardDescription>Your recent transactions and spending</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">This Month</span>
                <span className="text-sm font-medium">{formatCurrency(totalContributions)}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-sm">Total Transactions</span>
                <span className="text-sm font-medium">{contributionCount}</span>
              </div>
            </div>
            <Button variant="outline" className="w-full" disabled>
              <Calendar className="h-4 w-4 mr-2" />
              View Full History (Coming Soon)
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Contributions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" />
            Recent Contributions
          </CardTitle>
          <CardDescription>
            Projects you&apos;ve supported and their environmental impact
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contributions.length > 0 ? (
            <div className="space-y-4">
              {contributions.slice(0, 5).map((contribution, idx) => {
                const project = projects.find((p) => p.id === contribution.projectId);
                return (
                  <div
                    key={`${contribution.projectId}-${contribution.createdAt}-${idx}`}
                    className="flex items-start justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium">{project?.title || contribution.projectTitle}</h4>
                      <p className="text-sm text-muted-foreground">
                        {new Date(contribution.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-green-600">
                        {formatCurrency(contribution.amount)}
                      </p>
                      {contribution.impactMetrics && (
                        <p className="text-xs text-muted-foreground">
                          {contribution.impactMetrics.trees &&
                            `${contribution.impactMetrics.trees} trees`}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>You haven&apos;t made any contributions yet.</p>
              <p className="text-sm mt-2">
                Visit the{" "}
                <a href="/projects" className="text-primary hover:underline">
                  Projects
                </a>{" "}
                page to get started!
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* TODO: Implement future features
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4" />
              Digital Wallet
            </CardTitle>
            <Badge variant="outline" className="w-fit">
              Coming Soon
            </Badge>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Manage virtual cards, link payment methods, and integrate with Stripe, Apple Pay, Google
            Pay, and Samsung Pay.
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Transaction History
            </CardTitle>
            <Badge variant="outline" className="w-fit">
              Coming Soon
            </Badge>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Track spending by category, view detailed transaction history, and analyze your
            financial habits.
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Leaf className="h-4 w-4" />
              Carbon Footprint
            </CardTitle>
            <Badge variant="outline" className="w-fit">
              Coming Soon
            </Badge>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Complete a lifestyle questionnaire, get personalized recommendations, and track your
            carbon reduction progress.
            TODO: Implement carbon footprint calculator logic
            1. Integrate with Environmental Impact APIs (e.g., Cloverly, Patch)
            2. Add questionnaire component for lifestyle assessment
            3. Calculate baseline footprint and suggest reduction actions
          </CardContent>
        </Card>
      </div>
      */}

      {/* TODO: Implement additional future features
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              More Features on the Horizon
            </CardTitle>
            <Badge variant="outline">In Development</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <Shield className="h-4 w-4" /> Security: Two-factor authentication, KYC verification,
              password management
            </li>
            <li className="flex items-center gap-2">
              <Award className="h-4 w-4" /> Gamification: Achievement milestones, unlockable
              rewards, leaderboards
            </li>
            <li className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Green Investments: ESG funds, green stocks,
              sustainable portfolios
            </li>
            <li className="flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Financial Tools: Payment scheduling, currency
              conversion, savings accounts
            </li>
          </ul>
        </CardContent>
      </Card>
      */}
    </div>
  );
}
