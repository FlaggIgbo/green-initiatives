import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/use-translation";
import { useSelector, useDispatch } from "react-redux";
import { useCurrency } from "@/hooks/use-currency";
import {
  getMyProjects,
  reset,
  selectMyProjects,
  updateProjectApprovalStatus,
} from "../features/projects/projectSlice";
import { APPROVAL_STATUS, USER_ROLES } from "@shared/schema-mongo";
import { toast } from "react-toastify";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PlusCircle,
  Edit,
  Eye,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  Target,
  ShieldCheck,
  LayoutGrid,
  List,
} from "lucide-react";
import { FundingBreakdownChart } from "@/components/dashboard/funding-breakdown-chart";
import type { RootState, AppDispatch } from "../app/store";

export default function PartnerDashboard() {
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();
  const { user } = useSelector((state: RootState) => state.auth);
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  const projects = useSelector(selectMyProjects);
  const { isLoading, isError, message } = useSelector((state: RootState) => state.project);

  useEffect(() => {
    if (user && (user.role === USER_ROLES.entity || user.role === USER_ROLES.admin)) {
      dispatch(getMyProjects());
    }

    return () => {
      dispatch(reset());
    };
  }, [user, dispatch]);

  // Redirect non-entity users
  useEffect(() => {
    if (user && user.role !== USER_ROLES.entity && user.role !== USER_ROLES.admin) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleApproval = async (id: string, status: string) => {
    try {
      await dispatch(updateProjectApprovalStatus({ id, status })).unwrap();
      toast.success(
        status === APPROVAL_STATUS.approved
          ? t.status.approved || "Approved"
          : t.status.rejected || "Rejected",
      );
    } catch (err) {
      toast.error(typeof err === "string" ? err : "Failed to update status");
    }
  };

  const getApprovalBadge = (status: string) => {
    switch (status) {
      case APPROVAL_STATUS.approved:
        return (
          <Badge className="bg-green-500 text-white">
            <CheckCircle className="h-3 w-3 mr-1" />
            {t.status.approved}
          </Badge>
        );
      case APPROVAL_STATUS.pending:
        return (
          <Badge className="bg-yellow-500 text-white">
            <Clock className="h-3 w-3 mr-1" />
            {t.status.pendingReview}
          </Badge>
        );
      case APPROVAL_STATUS.rejected:
        return (
          <Badge className="bg-red-500 text-white">
            <XCircle className="h-3 w-3 mr-1" />
            {t.status.rejected}
          </Badge>
        );
      default:
        return null;
    }
  };

  const stats = useMemo(() => {
    if (!projects) return { total: 0, approved: 0, pending: 0, totalFunding: 0, totalRaised: 0 };

    return {
      total: projects.length,
      approved: projects.filter((p) => p.approvalStatus === APPROVAL_STATUS.approved).length,
      pending: projects.filter((p) => p.approvalStatus === APPROVAL_STATUS.pending).length,
      totalFunding: projects.reduce((sum, p) => sum + (p.targetFunding ?? 0), 0),
      totalRaised: projects.reduce((sum, p) => sum + (p.currentFunding ?? 0), 0),
    };
  }, [projects]);

  const renderStatsCards = () => {
    if (isLoading && (!projects || projects.length === 0)) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24 mb-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t.dashboard.totalProjects}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              {t.dashboard.approvedProjects}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.approved}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              {t.status.pendingReview}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-500" />
              {t.dashboard.totalRaised}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(stats.totalRaised ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {(stats.totalFunding ?? 0) > 0
                ? t.dashboard.goalText.replace(
                    "{{amount}}",
                    formatCurrency(stats.totalFunding ?? 0),
                  )
                : t.dashboard.ongoingDonations}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  };

  const isVerifiedPartner = stats.approved > 0;

  return (
    <div className="container mx-auto py-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-foreground">{t.dashboard.title}</h1>
            {isVerifiedPartner && (
              <Badge
                variant="secondary"
                className="gap-1.5 bg-green-500/15 text-green-700 dark:text-green-400"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {t.dashboard.verifiedPartner ?? "Verified Partner"}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">{t.dashboard.subtitle}</p>
        </div>
        <Button onClick={() => navigate("/create")} size="lg" className="gap-2">
          <PlusCircle className="h-5 w-5" />
          {t.dashboard.createNewProject}
        </Button>
      </div>

      {/* Stats Cards */}
      {renderStatsCards()}

      {/* Charts Row - Funding breakdown when projects exist */}
      {projects && projects.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">
                {t.dashboard.fundingByProject ?? "Funding by Project"}
              </CardTitle>
              <CardDescription>
                {t.dashboard.fundingBreakdownDesc ??
                  "Distribution of raised funds across your projects"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FundingBreakdownChart
                projects={projects}
                formatAmount={formatCurrency}
                emptyMessage={t.dashboard.noFundingYet ?? "No projects with funding yet"}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Projects List */}
      <Card>
        <CardHeader>
          <div
            className={`flex flex-col sm:flex-row sm:items-center gap-3 ${
              !projects || projects.length === 0 ? "sm:justify-center" : "sm:justify-between"
            }`}
          >
            <div className={!projects || projects.length === 0 ? "text-center" : ""}>
              <CardTitle>{t.dashboard.yourProjects}</CardTitle>
              <CardDescription>{t.dashboard.yourProjectsDescription}</CardDescription>
            </div>
            {projects && projects.length > 0 && (
              <div className="flex gap-1">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className="gap-1.5"
                >
                  <LayoutGrid className="h-4 w-4" />
                  {t.dashboard.gridView ?? "Grid"}
                </Button>
                <Button
                  variant={viewMode === "table" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("table")}
                  className="gap-1.5"
                >
                  <List className="h-4 w-4" />
                  {t.dashboard.tableView ?? "Table"}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && (!projects || projects.length === 0) ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col sm:flex-row gap-4 border p-4 rounded-lg">
                  <Skeleton className="h-48 sm:h-32 sm:w-48 rounded" />
                  <div className="space-y-3 flex-1">
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <div className="flex gap-2">
                      <Skeleton className="h-8 w-20" />
                      <Skeleton className="h-8 w-20" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="text-center py-12 text-destructive">
              <p className="font-semibold mb-2">{t.dashboard.errorLoading}</p>
              <p className="text-sm mb-4">{message}</p>
              <Button onClick={() => dispatch(getMyProjects())} variant="outline">
                {t.common.tryAgain}
              </Button>
            </div>
          ) : !projects || projects.length === 0 ? (
            <div className="text-center py-12">
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t.dashboard.noProjectsYet}</h3>
              <p className="text-muted-foreground mb-4">{t.dashboard.noProjectsDescription}</p>
              <Button onClick={() => navigate("/create")} className="gap-2">
                <PlusCircle className="h-4 w-4" />
                {t.dashboard.createProject}
              </Button>
            </div>
          ) : viewMode === "table" ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.dashboard.projectName ?? "Project"}</TableHead>
                    <TableHead>{t.dashboard.statusColumn}</TableHead>
                    <TableHead className="text-right">{t.dashboard.fundingProgress}</TableHead>
                    <TableHead className="text-right">{t.dashboard.projectCompletion}</TableHead>
                    <TableHead className="w-[140px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <img
                            src={project.imageUrl}
                            alt=""
                            className="h-10 w-10 rounded object-cover"
                          />
                          <div>
                            <p className="font-medium">{project.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {project.description}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getApprovalBadge(project.approvalStatus)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(project.currentFunding ?? 0)}
                        {project.targetFunding != null && project.targetFunding > 0 && (
                          <> / {formatCurrency(project.targetFunding)}</>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{project.progress ?? 0}%</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/project/${project.id}`)}
                            className="h-8 gap-1"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {t.common.view}
                          </Button>
                          {project.approvalStatus !== APPROVAL_STATUS.rejected && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/project/${project.id}/edit`)}
                              className="h-8 gap-1"
                            >
                              <Edit className="h-3.5 w-3.5" />
                              {t.common.edit}
                            </Button>
                          )}
                          {user?.role === USER_ROLES.admin &&
                            project.approvalStatus === APPROVAL_STATUS.pending && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleApproval(project.id, APPROVAL_STATUS.approved)
                                  }
                                  className="h-8 gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                                >
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  {t.common.approve}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleApproval(project.id, APPROVAL_STATUS.rejected)
                                  }
                                  className="h-8 gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                  {t.common.reject}
                                </Button>
                              </>
                            )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="space-y-4">
              {projects.map((project) => (
                <Card key={project.id} className="overflow-hidden">
                  <div className="flex flex-col sm:flex-row gap-4">
                    {/* Project Image */}
                    <div className="relative h-48 sm:h-auto sm:w-48 flex-shrink-0">
                      <img
                        src={project.imageUrl}
                        alt={project.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 right-2">
                        {getApprovalBadge(project.approvalStatus)}
                      </div>
                    </div>

                    {/* Project Details */}
                    <div className="flex-1 p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="text-xl font-semibold mb-1">{project.title}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {project.description}
                          </p>
                        </div>
                      </div>

                      {/* Funding Progress */}
                      <div className="mt-4 mb-4">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-muted-foreground">
                            {t.dashboard.fundingProgress}
                          </span>
                          <span className="font-semibold">
                            {formatCurrency(project.currentFunding ?? 0)}
                            {project.targetFunding != null && project.targetFunding > 0
                              ? ` / ${formatCurrency(project.targetFunding ?? 0)}`
                              : ` ${t.dashboard.ongoing}`}
                          </span>
                        </div>
                        {project.targetFunding != null && project.targetFunding > 0 ? (
                          <Progress
                            value={(project.currentFunding / project.targetFunding) * 100}
                            className="h-2"
                          />
                        ) : null}
                      </div>

                      {/* Project Progress - only for projects with funding goals */}
                      {project.targetFunding != null && project.targetFunding > 0 && (
                        <div className="mb-4">
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-muted-foreground">
                              {t.dashboard.projectCompletion}
                            </span>
                            <span className="font-semibold">{project.progress}%</span>
                          </div>
                          <Progress value={project.progress} className="h-2" />
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/project/${project.id}`)}
                          className="gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          {t.common.view}
                        </Button>
                        {project.approvalStatus !== APPROVAL_STATUS.rejected && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/project/${project.id}/edit`)}
                            className="gap-2"
                          >
                            <Edit className="h-4 w-4" />
                            {t.common.edit}
                          </Button>
                        )}
                        {project.approvalStatus === APPROVAL_STATUS.approved && (
                          <Button variant="outline" size="sm" className="gap-2">
                            <TrendingUp className="h-4 w-4" />
                            {t.dashboard.updateProgress}
                          </Button>
                        )}
                        {user?.role === USER_ROLES.admin &&
                          project.approvalStatus === APPROVAL_STATUS.pending && (
                            <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleApproval(project.id, APPROVAL_STATUS.approved)}
                                className="gap-2 bg-green-600 hover:bg-green-700 flex-1 sm:flex-none"
                              >
                                <CheckCircle className="h-4 w-4" />
                                {t.common.approve}
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleApproval(project.id, APPROVAL_STATUS.rejected)}
                                className="gap-2 flex-1 sm:flex-none"
                              >
                                <XCircle className="h-4 w-4" />
                                {t.common.reject}
                              </Button>
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
