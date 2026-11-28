export interface AlertBannerProps {
  variant: "success" | "error" | "warning";
  message: string;
  compact?: boolean;
}

const VARIANT_CLASSES: Record<AlertBannerProps["variant"], string> = {
  success: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border border-red-200 bg-red-50 text-red-700",
  warning: "border border-amber-200 bg-amber-50 text-amber-800",
};

export function AlertBanner({ variant, message, compact = false }: AlertBannerProps) {
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={`rounded-lg ${compact ? "px-3 py-2 text-xs" : "px-4 py-2.5 text-sm"} ${VARIANT_CLASSES[variant]}`}
    >
      {message}
    </div>
  );
}
