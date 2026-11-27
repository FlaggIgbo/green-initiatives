import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import { AppLink } from "./ui/app-link";
import { prefetchMap } from "@/app/App";
import type { Project } from "@shared/schema-mongo";
import { ProgressIndicator } from "./progress-indicator";
import { OptimizedImage } from "./ui/optimized-image";
import { useCurrency } from "@/hooks/use-currency";
import { memo } from "react";

interface ProjectCardProps {
  project: Project;
}

export const ProjectCard = memo(function ProjectCard({ project }: ProjectCardProps) {
  const { currencySymbol } = useCurrency();
  return (
    <Card className="overflow-hidden">
      <OptimizedImage
        src={project.imageUrl || ""}
        alt={project.title}
        className="h-48 w-full object-cover"
      />
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              <AppLink
                to={`/project/${project.id}`}
                className="hover:text-primary"
                component={prefetchMap.ProjectDetails}
              >
                {project.title}
              </AppLink>
            </h3>
            <div className="flex items-center mt-1 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 mr-1" />
              <span>{project.location?.address}</span>
            </div>
          </div>
          <Badge variant={project.status === "active" ? "default" : "secondary"}>
            {project.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        <ProgressIndicator
          current={Number(project.currentFunding) || 0}
          target={project.targetFunding ?? undefined}
          unitPrefix={currencySymbol}
        />
      </CardFooter>
    </Card>
  );
});
