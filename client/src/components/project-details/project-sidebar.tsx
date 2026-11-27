import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProgressIndicator } from "@/components/progress-indicator";
import { useCurrency } from "@/hooks/use-currency";
import { Loader2 } from "lucide-react";

export interface ProjectSidebarProps {
  currentFunding: number;
  targetFunding?: number | null;
  onSupport: (amount: number) => void;
  isSupporting?: boolean;
}

export function ProjectSidebar({
  currentFunding,
  targetFunding,
  onSupport,
  isSupporting = false,
}: ProjectSidebarProps) {
  const { formatCurrency, currencySymbol } = useCurrency();
  const [isCustom, setIsCustom] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [clickedAmount, setClickedAmount] = useState<number | null>(null);

  useEffect(() => {
    if (!isSupporting) {
      setClickedAmount(null);
    }
  }, [isSupporting]);

  const handleQuickSupport = (amount: number) => {
    setClickedAmount(amount);
    onSupport(amount);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(customAmount);
    if (!isNaN(amount) && amount > 0) {
      setClickedAmount(null); // Reset quick click if custom used
      onSupport(amount);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Funding Status</h2>
          <ProgressIndicator
            current={currentFunding}
            target={targetFunding ?? undefined}
            unitPrefix={currencySymbol}
          />
        </div>

        <div className="space-y-4">
          <h3 className="font-medium">Support this project</h3>

          {!isCustom ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={() => handleQuickSupport(10)}
                  disabled={isSupporting}
                >
                  {isSupporting && clickedAmount === 10 ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    formatCurrency(10)
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleQuickSupport(25)}
                  disabled={isSupporting}
                >
                  {isSupporting && clickedAmount === 25 ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    formatCurrency(25)
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleQuickSupport(50)}
                  disabled={isSupporting}
                >
                  {isSupporting && clickedAmount === 50 ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    formatCurrency(50)
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleQuickSupport(100)}
                  disabled={isSupporting}
                >
                  {isSupporting && clickedAmount === 100 ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    formatCurrency(100)
                  )}
                </Button>
              </div>
              <Button
                className="w-full text-muted-foreground hover:text-primary"
                variant="ghost"
                size="sm"
                onClick={() => setIsCustom(true)}
                disabled={isSupporting}
              >
                Custom Amount
              </Button>
            </div>
          ) : (
            <form onSubmit={handleCustomSubmit} className="space-y-3">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {currencySymbol}
                </span>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  className="pl-7"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  min="1"
                  step="0.01"
                  required
                  autoFocus
                  disabled={isSupporting}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setIsCustom(false)}
                  disabled={isSupporting}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={isSupporting}>
                  {isSupporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing
                    </>
                  ) : (
                    "Donate Now"
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
