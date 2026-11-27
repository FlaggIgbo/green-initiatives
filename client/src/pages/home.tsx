import { ProjectCard } from "@/components/project-card";
import { ProjectCardSkeleton } from "@/components/project-card-skeleton";
import { MapView } from "@/components/map-view";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/use-translation";
import { useState, useEffect, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { getProjects, reset, selectAllProjects } from "../features/projects/projectSlice";
import { FaLeaf } from "react-icons/fa";
import { useSEO } from "@/hooks/use-seo";
import type { RootState, AppDispatch } from "../app/store";

export default function Home() {
  const { t } = useTranslation();
  const dispatch = useDispatch<AppDispatch>();
  const [search, setSearch] = useState("");

  const projects = useSelector(selectAllProjects);
  const { isLoading, isError, message } = useSelector((state: RootState) => state.project);

  useSEO({
    title: t.home.title,
    description: t.home.subtitle,
  });

  useEffect(() => {
    dispatch(getProjects());

    return () => {
      dispatch(reset());
    };
  }, [dispatch]);

  const filteredProjects = useMemo(() => {
    return projects.filter(
      (project) =>
        project.title.toLowerCase().includes(search.toLowerCase()) ||
        project.description.toLowerCase().includes(search.toLowerCase()),
    );
  }, [projects, search]);

  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center text-destructive p-8 border border-destructive/20 rounded-lg bg-destructive/5">
          <p className="font-semibold mb-2">{t.errors.loadingProjects}</p>
          <p className="text-sm">{message || t.errors.unexpectedError}</p>
          <Button onClick={() => dispatch(getProjects())} variant="outline" className="mt-4">
            {t.common.tryAgain}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center text-center px-4">
        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-4">
          <FaLeaf className="h-6 w-6 sm:h-8 sm:w-8 text-primary flex-shrink-0" />
          <h1 className="text-2xl sm:text-4xl font-bold leading-tight">{t.home.title}</h1>
        </div>
        <p className="text-base sm:text-lg text-muted-foreground mb-6 max-w-2xl mx-auto leading-relaxed">
          {t.home.subtitle}
        </p>
        <Input
          id="home-search"
          name="home-search"
          placeholder={t.home.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md mx-auto"
        />
      </div>

      {isLoading && projects.length === 0 ? (
        <div className="space-y-8">
          <Skeleton className="h-[300px] w-full rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <ProjectCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : (
        <>
          <MapView projects={filteredProjects} className="rounded-lg" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
          {filteredProjects.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No projects found matching your search.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
