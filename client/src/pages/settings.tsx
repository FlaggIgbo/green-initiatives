import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useTranslation } from "@/hooks/use-translation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  Bell,
  Lock,
  Settings as SettingsIcon,
  Save,
  Trash2,
  ChevronLeft,
  Landmark,
  Loader2,
  Search,
  Plus,
  Check,
  DollarSign,
  MessageSquare,
  Scale,
  ExternalLink,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { RootState, AppDispatch } from "../app/store";
import { toast } from "react-toastify";
import { updateRoundupSettings, checkAuth } from "../features/auth/authSlice";
import {
  getLinkedAccounts,
  unlinkAccount,
  createMockLinkAccount,
} from "../features/roundup/roundupService";
import projectService from "../features/projects/projectService";
import { SUPPORTED_CURRENCIES } from "@shared/schema-mongo";
import type { LinkedBankAccount } from "@shared/schema-mongo";
import type { Project } from "@shared/schema-mongo";
import { useCurrency } from "@/hooks/use-currency";
import { submitFeedback } from "@/features/feedback/feedbackService";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export default function Settings() {
  const { user } = useSelector((state: RootState) => state.auth);
  const { stripeDisabled } = useSelector((state: RootState) => state.config);
  const { t } = useTranslation();
  const { currency, setCurrency, formatCurrency } = useCurrency();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const roundupLinked = searchParams.get("roundup") === "linked";
  const tabParam = searchParams.get("tab");
  const activeTab = ["profile", "roundup", "account", "notifications", "feedback"].includes(
    tabParam || "",
  )
    ? tabParam!
    : "profile";

  const [roundUpEnabled, setRoundUpEnabled] = useState(user?.roundUpEnabled || false);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedBankAccount[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(
    user?.roundUpProjectIds ?? (user?.selectedRoundUpProject ? [user.selectedRoundUpProject] : []),
  );
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  // Plaid Link States
  // TODO: Replace simulated dialog state with react-plaid-link (`usePlaidLink`) once
  // POST /api/roundup/plaid/link-token and /api/roundup/plaid/exchange-token are wired up.
  const [isPlaidOpen, setIsPlaidOpen] = useState(false);
  const [plaidStep, setPlaidStep] = useState<
    "bank-select" | "login" | "accounts" | "loading" | "success"
  >("bank-select");
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [bankUsername, setBankUsername] = useState("");
  const [bankPassword, setBankPassword] = useState("");

  useEffect(() => {
    setRoundUpEnabled(user?.roundUpEnabled || false);
    setSelectedProjectIds(
      user?.roundUpProjectIds?.length
        ? user.roundUpProjectIds
        : user?.selectedRoundUpProject
          ? [user.selectedRoundUpProject]
          : [],
    );
  }, [user]);

  const fetchLinkedAccounts = async (silent = false): Promise<LinkedBankAccount[]> => {
    if (!silent) setIsLoadingAccounts(true);
    try {
      const accounts = await getLinkedAccounts();
      setLinkedAccounts(accounts);
      return accounts;
    } catch {
      setLinkedAccounts([]);
      return [];
    } finally {
      if (!silent) setIsLoadingAccounts(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchLinkedAccounts();
      projectService
        .getProjects()
        .then(setProjects)
        .catch(() => setProjects([]));
    }
  }, [user]);

  // Poll when user returns from bank linking
  useEffect(() => {
    if (!roundupLinked || !user) return;
    const id = setInterval(fetchLinkedAccounts, 2000);
    return () => clearInterval(id);
  }, [roundupLinked, user]);

  const handleSaveProfile = () => {
    toast.success("Profile updated successfully!");
  };

  const handleSubmitFeedback = async () => {
    const trimmed = feedbackMessage.trim();
    if (!trimmed) {
      toast.error(t.settings?.feedbackRequired ?? "Please enter your feedback");
      return;
    }
    setIsSubmittingFeedback(true);
    try {
      await submitFeedback(trimmed);
      setFeedbackMessage("");
      toast.success(t.settings?.feedbackSubmitted ?? "Thank you for your feedback!");
    } catch {
      toast.error(t.settings?.feedbackFailed ?? "Failed to submit feedback");
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleRoundUpToggle = async (enabled: boolean) => {
    setRoundUpEnabled(enabled);
    try {
      await dispatch(
        updateRoundupSettings({
          enabled,
          projectIds: selectedProjectIds.length ? selectedProjectIds : undefined,
        }),
      ).unwrap();
      await dispatch(checkAuth());
      toast.success(`Round-up ${enabled ? "enabled" : "disabled"}`);
    } catch (_error) {
      toast.error("Failed to update settings");
    }
  };

  const handleLinkBank = async () => {
    // TODO: Call createPlaidLinkToken() and open Plaid Link widget instead of the simulated dialog
    setSelectedBank(null);
    setBankUsername("");
    setBankPassword("");
    setPlaidStep("bank-select");
    setIsPlaidOpen(true);
  };

  const handleUnlink = async (stripeAccountId: string) => {
    try {
      await unlinkAccount(stripeAccountId);
      setLinkedAccounts((prev) => prev.filter((a) => a.stripeAccountId !== stripeAccountId));
      toast.success("Account unlinked");
    } catch {
      toast.error("Failed to unlink account");
    }
  };

  const handleProjectToggle = (projectId: string, checked: boolean) => {
    const next = checked
      ? [...selectedProjectIds, projectId]
      : selectedProjectIds.filter((id) => id !== projectId);
    setSelectedProjectIds(next);
  };

  const handleSaveRoundUpProjects = async () => {
    try {
      await dispatch(
        updateRoundupSettings({
          enabled: roundUpEnabled,
          projectIds: selectedProjectIds,
        }),
      ).unwrap();
      await dispatch(checkAuth());
      toast.success("Round-up projects saved");
    } catch {
      toast.error("Failed to save");
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col items-start">
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2 text-muted-foreground"
          onClick={() => navigate("/profile")}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Profile
        </Button>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <SettingsIcon className="h-8 w-8" />
          {t.navigation?.settings || "Settings"}
        </h1>
        <p className="text-muted-foreground mt-1">Manage your account settings and preferences</p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) =>
          setSearchParams((p) => {
            const next = new URLSearchParams(p);
            next.set("tab", v);
            return next;
          })
        }
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="roundup" className="flex items-center gap-2">
            <Landmark className="h-4 w-4" />
            Round-up
          </TabsTrigger>
          <TabsTrigger value="account" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Account
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="feedback" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Feedback
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roundup" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Round-up Donations</CardTitle>
              <CardDescription>
                Link your bank account and round up everyday purchases to support environmental
                projects.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 text-left">
                  <Label>Enable Round-up</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically donate spare change from linked transactions
                  </p>
                </div>
                <Switch checked={roundUpEnabled} onCheckedChange={handleRoundUpToggle} />
              </div>
              {stripeDisabled && (
                <div className="rounded-md bg-yellow-50 p-4 dark:bg-yellow-900/20">
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    Payment features are temporarily disabled.
                  </p>
                </div>
              )}
              <Separator />

              <div className="space-y-4">
                <Label>Linked Bank Accounts</Label>
                <p className="text-sm text-muted-foreground">
                  Connect your bank to enable round-up donations. Transactions are monitored via
                  Plaid.
                </p>
                {isLoadingAccounts ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading accounts...
                  </div>
                ) : (
                  <div className="space-y-2">
                    {linkedAccounts.map((acc) => (
                      <div
                        key={acc.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <p className="font-medium">
                            {acc.displayName || "Bank account"} • {acc.institutionName || "Bank"}
                          </p>
                          {acc.last4 && (
                            <p className="text-xs text-muted-foreground">•••• {acc.last4}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => handleUnlink(acc.stripeAccountId)}
                        >
                          Unlink
                        </Button>
                      </div>
                    ))}
                    {linkedAccounts.length === 0 && (
                      <p className="text-sm text-muted-foreground">No bank accounts linked.</p>
                    )}
                  </div>
                )}
                <Button onClick={handleLinkBank} className="flex items-center gap-2">
                  <Landmark className="h-4 w-4" />
                  Link Bank Account
                </Button>
              </div>
              <Separator />

              <div className="space-y-4">
                <Label>Split Round-up Across Projects</Label>
                <p className="text-sm text-muted-foreground">
                  Search for projects and add them below. Round-up amounts are split evenly across
                  selected projects.
                </p>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search projects..."
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Search results - projects to add */}
                {projectSearch.trim() && (
                  <div className="rounded-lg border p-2 max-h-40 overflow-y-auto space-y-1">
                    {projects
                      .filter(
                        (p) =>
                          p.approvalStatus === "approved" &&
                          !selectedProjectIds.includes(p.id) &&
                          p.title.toLowerCase().includes(projectSearch.trim().toLowerCase()),
                      )
                      .slice(0, 8)
                      .map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleProjectToggle(p.id, true)}
                          className="w-full flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted transition-colors"
                        >
                          <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium">{p.title}</span>
                        </button>
                      ))}
                    {projects.filter(
                      (p) =>
                        p.approvalStatus === "approved" &&
                        !selectedProjectIds.includes(p.id) &&
                        p.title.toLowerCase().includes(projectSearch.trim().toLowerCase()),
                    ).length === 0 && (
                      <p className="px-2 py-3 text-sm text-muted-foreground">
                        No matching projects, or all are already selected.
                      </p>
                    )}
                  </div>
                )}

                {/* Selected projects - checklisted with remove */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Selected projects</Label>
                  <div className="rounded-lg border p-3 min-h-[80px] space-y-2">
                    {selectedProjectIds.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">
                        No projects selected. Search above to add projects.
                      </p>
                    ) : (
                      selectedProjectIds.map((id) => {
                        const p = projects.find((x) => x.id === id);
                        return (
                          <div
                            key={id}
                            className="flex items-center justify-between gap-2 rounded-md px-2 py-2 bg-muted/50"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Check className="h-4 w-4 text-primary shrink-0" />
                              <span className="text-sm font-medium truncate">
                                {p?.title ?? "Project"}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="shrink-0 h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => handleProjectToggle(id, false)}
                              aria-label="Remove project"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <Button onClick={handleSaveRoundUpProjects}>Save Round-up Projects</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                {t.settings?.currencyPreference ?? "Display Currency"}
              </CardTitle>
              <CardDescription>
                {t.settings?.currencyDescription ??
                  "Choose how monetary amounts are displayed across the app"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={currency}
                onValueChange={async (v) => {
                  try {
                    await setCurrency(v as "USD" | "MXN" | "BRL");
                    toast.success("Currency updated");
                  } catch {
                    toast.error(t.settings?.failedToUpdate ?? "Failed to update");
                  }
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c} ({formatCurrency(100)}) —{" "}
                      {c === "USD" ? "US Dollar" : c === "MXN" ? "Mexican Peso" : "Brazilian Real"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-2">
                {t.settings?.currencyDefaultFromLocale ??
                  "Defaults from your language when not set."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal details and how others see you</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input id="fullName" defaultValue={user.fullName || ""} placeholder="Your name" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    defaultValue={user.email || ""}
                    placeholder="email@example.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    defaultValue={user.phoneNumber || ""}
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
              </div>
              <Button onClick={handleSaveProfile} className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Security</CardTitle>
              <CardDescription>Manage your password and security settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input id="current-password" type="password" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input id="new-password" type="password" />
                </div>
              </div>
              <Button variant="outline">Update Password</Button>

              <Separator />

              <div className="pt-2">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  {t.settings?.legalTitle ?? "Legal"}
                </h4>
                <p className="text-sm text-muted-foreground mb-4">
                  {t.settings?.legalDescription ?? "Review our legal policies and agreements"}
                </p>
                {/* TODO: Once TOS/Privacy docs are self-hosted, replace these external links with internal <Link to="/terms"> / <Link to="/privacy"> and import Link from react-router-dom */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button variant="outline" className="gap-2" asChild>
                    <a
                      href="https://docs.google.com/document/d/1z2uFVSLxRA3Nd74C5qRwEO0-S87FW-k-/edit"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t.common.termsOfService}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                  <Button variant="outline" className="gap-2" asChild>
                    <a
                      href="https://docs.google.com/document/d/1WRUei7Ua3kAricHv6KulE_rk_JfqyBAU/edit"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t.common.privacyNotice}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="pt-2">
                <h4 className="text-sm font-medium text-destructive mb-2">Danger Zone</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Once you delete your account, there is no going back. Please be certain.
                </p>
                <Button variant="destructive" className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feedback" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {t.settings?.feedbackTitle ?? "Send Feedback"}
              </CardTitle>
              <CardDescription>
                {t.settings?.feedbackDescription ??
                  "Share your thoughts, report issues, or suggest improvements. We read every submission."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="feedback-message">
                  {t.settings?.feedbackLabel ?? "Your feedback"}
                </Label>
                <Textarea
                  id="feedback-message"
                  placeholder={t.settings?.feedbackPlaceholder ?? "Tell us what's on your mind..."}
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  rows={5}
                  className="resize-none"
                  maxLength={5000}
                />
                <p className="text-xs text-muted-foreground">{feedbackMessage.length}/5000</p>
              </div>
              <Button
                onClick={handleSubmitFeedback}
                disabled={isSubmittingFeedback || !feedbackMessage.trim()}
                className="gap-2"
              >
                {isSubmittingFeedback ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MessageSquare className="h-4 w-4" />
                )}
                {t.settings?.feedbackSubmit ?? "Submit Feedback"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Choose what updates you want to receive</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 text-left">
                    <Label>Project Updates</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications about projects you&apos;ve supported
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 text-left">
                    <Label>Environmental Impact Milestones</Label>
                    <p className="text-sm text-muted-foreground">
                      Get alerted when your direct impact reaches new heights
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 text-left">
                    <Label>Round-up Donations</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable automatic spare change contributions (configure in Round-up tab)
                    </p>
                  </div>
                  <Switch checked={roundUpEnabled} onCheckedChange={handleRoundUpToggle} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Plaid Link Simulated Dialog */}
      <Dialog open={isPlaidOpen} onOpenChange={setIsPlaidOpen}>
        <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl">
          <div className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />
              <span className="font-bold text-zinc-900 dark:text-zinc-50 text-sm tracking-wide uppercase">
                Plaid Link
              </span>
            </div>
            <div className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold px-2 py-0.5 rounded-full uppercase">
              Sandbox
            </div>
          </div>

          {plaidStep === "bank-select" && (
            <div className="p-6 space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  Select your bank
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Connect your account securely to enable round-ups
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                {[
                  { name: "Plaid Sandbox Bank", color: "bg-emerald-500/10 text-emerald-600" },
                  { name: "Chase", color: "bg-blue-500/10 text-blue-600" },
                  { name: "Bank of America", color: "bg-red-500/10 text-red-600" },
                  { name: "Wells Fargo", color: "bg-amber-500/10 text-amber-600" },
                  { name: "Citibank", color: "bg-sky-500/10 text-sky-600" },
                  { name: "Capital One", color: "bg-cyan-500/10 text-cyan-600" },
                ].map((bank) => (
                  <button
                    key={bank.name}
                    type="button"
                    onClick={() => {
                      setSelectedBank(bank.name);
                      setPlaidStep("login");
                    }}
                    className="flex flex-col items-center justify-center p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:border-emerald-500 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all text-center group"
                  >
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-xs ${bank.color} group-hover:scale-105 transition-transform`}
                    >
                      {bank.name.charAt(0)}
                    </div>
                    <span className="text-xs font-semibold mt-2 text-zinc-700 dark:text-zinc-300">
                      {bank.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {plaidStep === "login" && (
            <div className="p-6 space-y-4">
              <button
                type="button"
                onClick={() => setPlaidStep("bank-select")}
                className="text-xs text-zinc-500 hover:text-zinc-700 flex items-center gap-1"
              >
                ← Back to banks
              </button>

              <div className="text-center">
                <div className="h-12 w-12 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center font-bold text-sm mx-auto mb-2">
                  {selectedBank?.charAt(0)}
                </div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  Login to {selectedBank}
                </h3>
                <p className="text-xs text-zinc-500 mt-1">Enter your online banking credentials</p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="space-y-1 text-left">
                  <Label
                    htmlFor="bank-username"
                    className="text-xs text-zinc-600 dark:text-zinc-400"
                  >
                    Username
                  </Label>
                  <Input
                    id="bank-username"
                    type="text"
                    value={bankUsername}
                    onChange={(e) => setBankUsername(e.target.value)}
                    placeholder="Enter username"
                    className="w-full h-10"
                  />
                </div>
                <div className="space-y-1 text-left">
                  <Label
                    htmlFor="bank-password"
                    className="text-xs text-zinc-600 dark:text-zinc-400"
                  >
                    Password
                  </Label>
                  <Input
                    id="bank-password"
                    type="password"
                    value={bankPassword}
                    onChange={(e) => setBankPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full h-10"
                  />
                </div>
              </div>

              <Button
                onClick={() => {
                  setPlaidStep("loading");
                  setTimeout(() => {
                    setPlaidStep("accounts");
                  }, 1500);
                }}
                disabled={!bankUsername || !bankPassword}
                className="w-full mt-2 h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                Sign In
              </Button>
            </div>
          )}

          {plaidStep === "loading" && (
            <div className="p-8 flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600 dark:text-emerald-500" />
              <div className="text-center">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                  Connecting securely...
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Verifying your credentials and locating accounts
                </p>
              </div>
            </div>
          )}

          {plaidStep === "accounts" && (
            <div className="p-6 space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  Select Account
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Choose the checking account to monitor for round-ups
                </p>
              </div>

              <div className="space-y-2 pt-2">
                {[
                  { id: "1", name: "Plaid Sandbox Checking", mask: "1234", balance: "$4,520.12" },
                  { id: "2", name: "Plaid Sandbox Savings", mask: "5678", balance: "$12,482.00" },
                ].map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    onClick={async () => {
                      setPlaidStep("loading");
                      try {
                        await createMockLinkAccount({
                          displayName: account.name,
                          institutionName: selectedBank || "Plaid Sandbox Bank",
                          last4: account.mask,
                        });
                        setPlaidStep("success");
                        // Refresh accounts list immediately
                        fetchLinkedAccounts();
                      } catch (err) {
                        console.error("[Settings] Failed mock linking:", err);
                        toast.error("Failed to link mock bank account");
                        setPlaidStep("accounts");
                      }
                    }}
                    className="w-full flex items-center justify-between p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:border-emerald-500 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all text-left"
                  >
                    <div>
                      <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                        {account.name}
                      </p>
                      <p className="text-xs text-zinc-500">•••• {account.mask}</p>
                    </div>
                    <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                      {account.balance}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {plaidStep === "success" && (
            <div className="p-6 space-y-6 text-center">
              <div className="h-16 w-16 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center font-bold text-2xl mx-auto">
                ✓
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  Account Linked!
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Your bank account has been connected via Plaid. Daily transactions will be
                  monitored to round-up your spare change.
                </p>
              </div>
              <Button
                onClick={() => {
                  setIsPlaidOpen(false);
                  dispatch(checkAuth());
                }}
                className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                Go to Dashboard
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
