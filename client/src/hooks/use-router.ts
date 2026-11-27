import { useNavigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { useMemo } from "react";

/**
 * useRouter hook
 * Mimics Next.js useRouter hook for programmatic navigation and route info
 */
export function useRouter() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [searchParams] = useSearchParams();

  return useMemo(() => {
    return {
      push: (url: string, options?: { replace?: boolean }) =>
        navigate(url, { replace: options?.replace }),
      replace: (url: string) => navigate(url, { replace: true }),
      back: () => navigate(-1),
      pathname: location.pathname,
      query: {
        ...params,
        ...Object.fromEntries(searchParams.entries()),
      },
      isReady: true, // In standard React Router, params are ready on mount
    };
  }, [navigate, location, params, searchParams]);
}
