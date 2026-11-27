import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { getProject, updateProjectProgress, reset } from "../features/projects/projectSlice";
import { useProjectUpdates } from "@/hooks/use-project-updates";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { ProjectHero } from "@/components/project-details/project-hero";
import { ProjectInfo } from "@/components/project-details/project-info";
import { ProjectDetailsSkeleton } from "@/components/project-details-skeleton";
import { useSEO } from "@/hooks/use-seo";
import type { RootState, AppDispatch } from "../app/store";

export default function ProjectDetails() {
  const { id: projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState) => state.auth);
  const [progressInput, setProgressInput] = useState("");
  const { sendProgressUpdate } = useProjectUpdates();

  const { currentProject: project, isLoading } = useSelector((state: RootState) => state.project);
  const { stripeDisabled } = useSelector((state: RootState) => state.config);
  const [isSupporting] = useState(false);

  useSEO({
    title: project?.title,
    description: project?.description,
  });

  useEffect(() => {
    if (projectId) {
      dispatch(getProject(projectId));
    }

    // Handle Stripe Redirect Status
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");

    if (success === "true") {
      toast({
        title: "Payment processed successfully! 🎉",
        description: "Thank you for your support. Your contribution helps us grow.",
      });
      // Remove query params from URL
      searchParams.delete("success");
      setSearchParams(searchParams, { replace: true });
    }

    if (canceled === "true") {
      toast({
        title: "Payment Canceled",
        description: "Your payment was not processed. No charges were made.",
        variant: "warning",
      });
      // Remove query params from URL
      searchParams.delete("canceled");
      setSearchParams(searchParams, { replace: true });
    }

    return () => {
      dispatch(reset());
    };
  }, [projectId, dispatch, searchParams, setSearchParams, toast]);

  const handleUpdateProgress = async (progress: number) => {
    if (!projectId) return;
    try {
      await dispatch(updateProjectProgress({ id: projectId, progress })).unwrap();
      sendProgressUpdate(projectId, progress);
      toast({
        title: "Success",
        description: "Project progress has been updated.",
      });
      setProgressInput("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update progress";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  if (isLoading && !project) return <ProjectDetailsSkeleton />;
  if (!project) return <div className="p-8 text-center">Project not found</div>;

  const isProjectOwner = user?.id === project.organizationId;

  const handleSupport = async (amount: number = 25) => {
    if (!projectId) return;

    // Stripe is temporarily inactive - Redirecting to fake donation page
    navigate(`/donate/${projectId}?amount=${amount}`);

    /* 
    // Commented out Stripe logic as requested
    if (stripeDisabled) {
      toast({
        title: "Payments Unavailable",
        description: "Donations are currently disabled as we are pending Stripe approval.",
        variant: "warning",
      });
      return;
    }

    // setIsSupporting(true);
    try {
      const response = await fetch(getApiUrl("/api/stripe/create-checkout-session"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          projectId,
          amount: amount,
        }),
        credentials: "include",
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        // clientLogger.error("Stripe checkout failed", {
        //   projectId,
        //   error: data.error,
        // });
        throw new Error(data.error || "Failed to create checkout session. Try again later.");
      }
    } catch (error) {
      // const err = error instanceof Error ? error : new Error(String(error));
      // clientLogger.error("Stripe checkout initialization failed", {
      //   projectId,
      //   amount,
      //   error: err.message,
      //   stack: err.stack,
      // });
      toast({
        title: "Payment Error",
        description: "Could not initialize Stripe checkout. Try again later.",
        variant: "destructive",
      });
      // setIsSupporting(false);
    }
    */
  };

  return (
    <div className="space-y-8">
      <ProjectHero imageUrl={project.imageUrl} title={project.title} />

      <div className="max-w-4xl mx-auto">
        <ProjectInfo
          project={project}
          isProjectOwner={isProjectOwner}
          progressInput={progressInput}
          onProgressInputChange={setProgressInput}
          onUpdateProgress={handleUpdateProgress}
          onSupport={handleSupport}
          isSupporting={isSupporting}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
