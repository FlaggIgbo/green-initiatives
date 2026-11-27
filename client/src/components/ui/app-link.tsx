import { Link, LinkProps } from "react-router-dom";
import { useCallback } from "react";

interface AppLinkProps extends Omit<LinkProps, "prefetch"> {
  prefetch?: boolean;
  component?: () => Promise<{ default: React.ComponentType<unknown> }>;
}

/**
 * AppLink component
 * Mimics Next.js Link component with:
 * - prefetch: Trigger pre-loading of components on hover
 * - scroll: (Handled by ScrollToTop component globally)
 */
export function AppLink({ prefetch = true, component, ...props }: AppLinkProps) {
  const handlePrefetch = useCallback(() => {
    if (prefetch && component) {
      // Trigger the lazy import
      component();
    }
  }, [prefetch, component]);

  return <Link {...props} onMouseEnter={handlePrefetch} onTouchStart={handlePrefetch} />;
}
