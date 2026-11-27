import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  fallback?: string;
  priority?: boolean;
}

/**
 * OptimizedImage component that handles:
 * - Lazy loading by default (unless priority is set)
 * - Loading skeletons
 * - Error fallback
 * - Smooth fade-in effect
 */
export function OptimizedImage({
  src,
  alt,
  className,
  fallback = "/images/project-placeholder.jpg",
  priority = false,
  ...props
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Reset state when src changes
    setLoaded(false);
    setError(false);
  }, [src]);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {!loaded && !error && <Skeleton className="absolute inset-0 w-full h-full" />}

      <img
        src={error ? fallback : src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={cn(
          "transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
          className,
        )}
        {...props}
      />
    </div>
  );
}
