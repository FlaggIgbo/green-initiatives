import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { MapView } from "@/components/map-view";
import { ProgressIndicator } from "@/components/progress-indicator";
import { Separator } from "@/components/ui/separator";
import { CommentsSection } from "@/components/comments-section";
import { ProjectSidebar } from "./project-sidebar";
import { useCurrency } from "@/hooks/use-currency";
import type { Project } from "@shared/schema-mongo";

interface ProjectInfoProps {
  project: Project;
  isProjectOwner: boolean;
  progressInput: string;
  onProgressInputChange: (value: string) => void;
  onUpdateProgress: (progress: number) => void;
  onSupport: (amount: number) => void;
  isSupporting?: boolean;
  isLoading: boolean;
}

export function ProjectInfo({
  project,
  isProjectOwner,
  progressInput,
  onProgressInputChange,
  onUpdateProgress,
  onSupport,
  isSupporting,
  isLoading,
}: ProjectInfoProps) {
  const { formatCurrency } = useCurrency();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{project.title}</h1>
        <Badge variant={project.status === "active" ? "default" : "secondary"}>
          {project.status}
        </Badge>
      </div>

      <p className="text-lg text-muted-foreground">{project.description}</p>

      {project.targetFunding != null && project.targetFunding > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Project Progress</h2>
          <p className="text-2xl font-bold text-primary">{project.progress ?? 0}% Complete</p>

          {isProjectOwner && (
            <div className="flex gap-4 mt-4">
              <Input
                type="number"
                min="0"
                max="100"
                value={progressInput}
                onChange={(e) => onProgressInputChange(e.target.value)}
                placeholder="Enter progress (0-100)"
                className="max-w-[200px]"
              />
              <Button
                onClick={() => {
                  const progress = Number(progressInput);
                  if (progress >= 0 && progress <= 100) {
                    onUpdateProgress(progress);
                  }
                }}
                disabled={isLoading}
              >
                {isLoading ? "Updating..." : "Update Progress"}
              </Button>
            </div>
          )}
        </div>
      )}

      {project.location &&
        typeof project.location.lat === "number" &&
        typeof project.location.lng === "number" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Project Location</h2>
            <MapView projects={[project]} className="h-[300px] rounded-lg" />
          </div>
        )}

      {project.impactMetrics && project.impactMetrics.type && (
        <div className="space-y-4 pt-4">
          <h2 className="text-xl font-semibold">Impact Tracking</h2>
          <Card>
            <CardContent className="pt-6">
              <ProgressIndicator
                current={project.impactMetrics.currentAmount}
                target={project.impactMetrics.targetAmount || 0}
                label={`${project.impactMetrics.type.charAt(0).toUpperCase()}${project.impactMetrics.type.slice(1)} ${project.impactMetrics.unit || ""}`}
                unitPrefix=""
                unitSuffix={` ${project.impactMetrics.unit || ""}`}
              />
              <p className="text-sm text-muted-foreground mt-4 italic">
                Every {formatCurrency(1)} contributed to this project helps achieve approximately{" "}
                {project.impactMetrics.perDollar} {project.impactMetrics.unit} of{" "}
                {project.impactMetrics.type} impact.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="pt-4">
        <ProjectSidebar
          currentFunding={project.currentFunding ?? 0}
          targetFunding={project.targetFunding ?? undefined}
          onSupport={onSupport}
          isSupporting={isSupporting}
        />
      </div>

      <Separator className="my-8" />
      <CommentsSection projectId={project.id} />
    </div>
  );
}
