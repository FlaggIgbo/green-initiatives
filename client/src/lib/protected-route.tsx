import { useSelector } from "react-redux";
import { Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";
import type { RootState } from "../app/store";
import React from "react";

export function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useSelector((state: RootState) => state.auth);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <Component />;
}
