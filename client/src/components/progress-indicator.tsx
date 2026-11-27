import { Progress } from "@/components/ui/progress";

interface ProgressIndicatorProps {
  current: number;
  target?: number | null;
  label?: string;
  unitPrefix?: string;
  unitSuffix?: string;
}

export function ProgressIndicator({
  current,
  target,
  label = "Raised",
  unitPrefix = "$",
  unitSuffix = "",
}: ProgressIndicatorProps) {
  const hasTarget = target != null && target > 0;

  const safeCurrent = current ?? 0;
  const safeTarget = target ?? 0;

  if (!hasTarget) {
    return (
      <div className="space-y-2">
        <div className="flex justify-between text-sm gap-4">
          <span className="text-muted-foreground">
            <span className="font-medium">{label}:</span> {unitPrefix}
            {safeCurrent.toLocaleString()}
            {unitSuffix}
          </span>
          <span className="text-muted-foreground text-xs">Ongoing</span>
        </div>
      </div>
    );
  }

  const percentage = Math.min(Math.round((safeCurrent / safeTarget) * 100), 100);

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm gap-4">
        <span className="text-muted-foreground">
          <span className="font-medium">{label}:</span> {unitPrefix}
          {safeCurrent.toLocaleString()}
          {unitSuffix}
        </span>
        <span className="text-muted-foreground">
          <span className="font-medium">Goal:</span> {unitPrefix}
          {safeTarget.toLocaleString()}
          {unitSuffix}
        </span>
      </div>
      <Progress value={percentage} className="h-2" />
    </div>
  );
}
