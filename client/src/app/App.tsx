import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Toaster } from "@/components/ui/toaster";
import { Layout } from "@/components/layout";
import { ThemeProvider, useTheme } from "@/contexts/theme-context";
import { TranslationProvider } from "@/hooks/use-translation";
import { ProtectedRoute } from "@/lib/protected-route";
import { Loader2 } from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import { ScrollToTop } from "@/components/scroll-to-top";
import { checkAuth } from "@/features/auth/authSlice";
import { getConfig } from "@/features/config/configSlice";
import { USER_ROLES } from "@shared/schema-mongo";
import type { RootState, AppDispatch } from "./store";

// Lazy load page components with prefetch-able imports
const Home = lazy(() => import("@/pages/home"));
const Projects = lazy(() => import("@/pages/projects"));
const ProjectDetails = lazy(() => import("@/pages/project-details"));
const AuthPage = lazy(() => import("@/pages/auth-page"));
const CreateProject = lazy(() => import("@/pages/create-project"));
const PartnerDashboard = lazy(() => import("@/pages/partner-dashboard"));
const Profile = lazy(() => import("@/pages/profile"));
const Settings = lazy(() => import("@/pages/settings"));
const RegisterEntity = lazy(() => import("@/pages/register-entity"));
const ForgotPassword = lazy(() => import("@/pages/forgot-password"));
const ResetPassword = lazy(() => import("@/pages/reset-password"));
const DonationFake = lazy(() => import("@/pages/donation-fake"));
const NotFound = lazy(() => import("@/pages/not-found"));

// Pre-export the import functions for AppLink prefetching
export const prefetchMap = {
  Home: () => import("@/pages/home"),
  Projects: () => import("@/pages/projects"),
  ProjectDetails: () => import("@/pages/project-details"),
  AuthPage: () => import("@/pages/auth-page"),
  CreateProject: () => import("@/pages/create-project"),
  PartnerDashboard: () => import("@/pages/partner-dashboard"),
  Profile: () => import("@/pages/profile"),
  Settings: () => import("@/pages/settings"),
  RegisterEntity: () => import("@/pages/register-entity"),
  DonationFake: () => import("@/pages/donation-fake"),
};

function ThemeAwareToastContainer() {
  const { resolvedTheme } = useTheme();
  return <ToastContainer theme={resolvedTheme} />;
}

// Loading fallback component
const PageLoader = () => (
  <div className="flex h-[calc(100vh-64px)] w-full items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

function AppRoutes() {
  const dispatch = useDispatch<AppDispatch>();
  const { user, isAuthChecked } = useSelector((state: RootState) => state.auth);
  const isEntity = user?.role === USER_ROLES.entity;
  const canAccessDashboardAndCreate =
    user && (user.role === USER_ROLES.entity || user.role === USER_ROLES.admin);

  // Validate server session and fetch config on app startup (handles hard refresh)
  useEffect(() => {
    dispatch(checkAuth());
    dispatch(getConfig());
  }, [dispatch]);

  // Show a loader until the server session check completes
  if (!isAuthChecked) {
    return <PageLoader />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={isEntity ? <Navigate to="/dashboard" replace /> : <Home />} />
        <Route
          path="/projects"
          element={isEntity ? <Navigate to="/profile" replace /> : <Projects />}
        />
        <Route path="/project/:id/edit" element={<ProtectedRoute component={ProjectDetails} />} />
        <Route path="/project/:id" element={<ProjectDetails />} />
        <Route path="/donate/:id" element={<DonationFake />} />

        <Route path="/profile" element={<ProtectedRoute component={Profile} />} />
        <Route path="/settings" element={<ProtectedRoute component={Settings} />} />
        <Route
          path="/create"
          element={
            canAccessDashboardAndCreate ? (
              <ProtectedRoute component={CreateProject} />
            ) : user ? (
              <Navigate to="/" replace />
            ) : (
              <ProtectedRoute component={CreateProject} />
            )
          }
        />
        <Route
          path="/dashboard"
          element={
            canAccessDashboardAndCreate ? (
              <ProtectedRoute component={PartnerDashboard} />
            ) : user ? (
              <Navigate to="/" replace />
            ) : (
              <ProtectedRoute component={PartnerDashboard} />
            )
          }
        />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/register-entity" element={<RegisterEntity />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <TranslationProvider>
        <Router>
          <ScrollToTop />
          <Suspense fallback={<PageLoader />}>
            <AppRoutes />
          </Suspense>
          <Toaster />
          <ThemeAwareToastContainer />
        </Router>
      </TranslationProvider>
    </ThemeProvider>
  );
}

export default App;
