import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useContext } from "react";

// Inline access to the translation context — avoids the throwing useTranslation() hook
// so this fallback works even when rendered outside <TranslationProvider>.
import { TranslationContext } from "@/hooks/use-translation";

interface DefaultErrorFallbackProps {
  error?: Error;
  onRetry: () => void;
  onReload: () => void;
}

export function DefaultErrorFallback({ error, onRetry, onReload }: DefaultErrorFallbackProps) {
  const ctx = useContext(TranslationContext);

  const title = ctx?.t.errorBoundary.title ?? "Something went wrong";
  const description =
    ctx?.t.errorBoundary.description ??
    "We encountered an unexpected error. Our team has been notified.";
  const tryAgain = ctx?.t.common.tryAgain ?? "Try Again";
  const reloadPage = ctx?.t.errorBoundary.reloadPage ?? "Reload Page";

  return (
    <div className="min-h-[400px] flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-center">{description}</p>

          {process.env.NODE_ENV !== "production" && error && (
            <div className="bg-muted p-3 rounded-md text-xs font-mono overflow-auto max-h-32">
              {error.message}
            </div>
          )}

          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={onRetry}>
              <RefreshCw className="w-4 h-4 mr-2" />
              {tryAgain}
            </Button>
            <Button onClick={onReload}>{reloadPage}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
