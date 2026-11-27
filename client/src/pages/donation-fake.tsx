import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CreditCard, Heart, ArrowLeft } from "lucide-react";
import { getApiUrl } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/auth-token";

export default function DonationFake() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [amount, setAmount] = useState(searchParams.get("amount") || "25");
  const [isProcessing, setIsProcessing] = useState(false);
  const [project, setProject] = useState<{ title: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const response = await fetch(getApiUrl(`/api/projects/${id}`));
        if (response.ok) {
          const data = await response.json();
          setProject(data);
        } else {
          console.error(
            `[DonationFake] Failed to fetch project. Response status: ${response.status}`,
          );
        }
      } catch (error) {
        console.error("[DonationFake] Error during project fetch:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProject();
  }, [id]);

  const handleDonate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      // 1. Post to the backend to register this contribution in the database
      const response = await fetch(getApiUrl(`/api/projects/${id}/fund`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ amount: Number(amount) }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API response error status: ${response.status}`);
      }

      await response.json();

      // Simulating a brief delay for a premium user experience
      await new Promise((resolve) => setTimeout(resolve, 1500));

      navigate(`/project/${id}?success=true`);
    } catch (error) {
      console.error("[DonationFake] Error registering funding:", error);
      toast({
        title: "Transaction Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to record contribution in the simulation.",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-8">
      <Button variant="ghost" className="mb-6" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Project
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-primary mb-2">
            <Heart className="h-5 w-5 fill-current" />
            <span className="font-semibold uppercase tracking-wider text-sm">Support Project</span>
          </div>
          <CardTitle className="text-3xl font-bold">
            {project?.title || "Complete Your Donation"}
          </CardTitle>
          <CardDescription>
            You are making a difference. Please confirm your contribution details below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form id="donation-form" onSubmit={handleDonate} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="amount">Donation Amount (USD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-7 text-lg"
                  required
                  min="1"
                />
              </div>
            </div>

            <div className="rounded-lg bg-muted p-4 space-y-4">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Payment Method (Simulation)</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Stripe is currently in maintenance mode. This transaction will be processed through
                our secondary secure gateway.
              </p>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button form="donation-form" className="w-full h-12 text-lg" disabled={isProcessing}>
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : (
              `Donate $${amount}`
            )}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            By clicking donate, you agree to our terms of service and acknowledge this is a
            demonstration environment.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
