import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { logout, reset, setRole, login } from "../features/auth/authSlice";
import { Cherry, Menu, AlertCircle, Shield, Settings, MessageSquare, Loader2 } from "lucide-react";
import {
  FaSignInAlt,
  FaSignOutAlt,
  FaUser,
  FaPlus,
  FaChartBar,
  FaProjectDiagram,
  FaHome,
} from "react-icons/fa";
import { useTranslation } from "@/hooks/use-translation";
import { Button } from "@/components/ui/button";
import { GrowingTree } from "./growing-tree";
import { LanguageSelector } from "./language-selector";
import { ThemeToggle } from "./theme-toggle";
import { getDetectedEnvironment } from "@/lib/api-config";
import { ENVIRONMENTS, USER_ROLES, type UserRole } from "@shared/schema-mongo";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useState } from "react";
import type { RootState, AppDispatch } from "../app/store";

export function Layout({ children }: { children?: React.ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const { t } = useTranslation();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const currentEnv = getDetectedEnvironment();
  const isDevelopment = currentEnv === ENVIRONMENTS.development;
  const isSandbox = currentEnv === ENVIRONMENTS.sandbox;
  const showEnvBanner = isDevelopment || isSandbox;

  const isAuthPage = location.pathname === "/auth";

  const onLogout = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    await dispatch(logout());
    dispatch(reset());
    navigate("/auth");
    setOpen(false);
  };

  const handleRoleChange = async (newRole: UserRole) => {
    if (!user) {
      // DEV/SANDBOX ONLY: Quick login as a default user for that role
      if (newRole === USER_ROLES.admin) {
        await dispatch(login({ username: "admin", password: "@berrybank1" }));
      } else if (newRole === USER_ROLES.entity) {
        await dispatch(login({ username: "mock_entity", password: "mock_password_123" }));
      } else {
        await dispatch(login({ username: "mock_user", password: "mock_password_123" }));
      }
    } else {
      dispatch(setRole(newRole));
    }
    navigate("/");
  };

  const RoleSwitcher = () => {
    const { isLoading } = useSelector((state: RootState) => state.auth);
    if (!isDevelopment && !isSandbox) return null;

    const availableRoles = isSandbox
      ? [USER_ROLES.user, USER_ROLES.entity]
      : [USER_ROLES.user, USER_ROLES.entity, USER_ROLES.admin];

    // Ensure we always pass a value that matches a SelectItem so the role label displays
    const displayRole =
      user?.role && availableRoles.includes(user.role) ? user.role : USER_ROLES.user;

    const getRoleLabel = (role: string) => {
      switch (role) {
        case USER_ROLES.admin:
          return t.common.roleAdmin;
        case USER_ROLES.entity:
          return t.common.roleEntity;
        default:
          return t.common.roleUser;
      }
    };

    return (
      <div className="flex items-center gap-2 bg-white/10 rounded-md px-2 py-1 sm:ml-4 border border-white/20">
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Shield className="h-3.5 w-3.5" />
        )}
        <span className="text-[10px] font-bold uppercase tracking-wider">
          {!user ? "Login As:" : `${t.navigation.role}:`}
        </span>
        <Select
          value={!user ? "" : displayRole}
          onValueChange={(v) => handleRoleChange(v as UserRole)}
          disabled={isLoading}
        >
          <SelectTrigger
            className="h-6 w-[80px] sm:w-[100px] text-[10px] bg-transparent border-none focus:ring-0 p-0"
            aria-label="Select Role"
          >
            <SelectValue placeholder={!user ? "Select Role" : getRoleLabel(displayRole)} />
          </SelectTrigger>
          <SelectContent>
            {availableRoles.map((role) => (
              <SelectItem key={role} value={role} className="text-[10px]">
                {getRoleLabel(role)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const NavigationLinks = () => {
    // User: Home, Projects only (no Dashboard/Create Project)
    // Public/User/Admin can see these, only Entity is redirected away
    const showHomeAndProjects =
      !user || user.role === USER_ROLES.user || user.role === USER_ROLES.admin;
    // Entity + Admin: Dashboard, Create Project (user role cannot see these)
    const showDashboardAndCreate =
      user && (user.role === USER_ROLES.entity || user.role === USER_ROLES.admin);

    return (
      <>
        {!isAuthPage && (
          <>
            {showHomeAndProjects && (
              <Link
                to="/"
                className="flex items-center gap-2 px-4 py-2 text-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
                onClick={() => setOpen(false)}
              >
                <FaHome className="h-4 w-4" />
                {t.navigation.home}
              </Link>
            )}
            {showHomeAndProjects && (
              <Link
                to="/projects"
                className="flex items-center gap-2 px-4 py-2 text-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
                onClick={() => setOpen(false)}
              >
                <FaProjectDiagram className="h-4 w-4" />
                {t.navigation.projects}
              </Link>
            )}
            {showDashboardAndCreate && (
              <Link
                to="/dashboard"
                className="flex items-center gap-2 px-4 py-2 text-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
                onClick={() => setOpen(false)}
              >
                <FaChartBar className="h-4 w-4" />
                {t.navigation.dashboard}
              </Link>
            )}
            {showDashboardAndCreate && (
              <Link
                to="/create"
                className="flex items-center gap-2 px-4 py-2 text-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
                onClick={() => setOpen(false)}
              >
                <FaPlus className="h-4 w-4" />
                {t.navigation.createProject}
              </Link>
            )}
            {user ? (
              <>
                <Link
                  to="/profile"
                  className="flex items-center gap-2 px-4 py-2 text-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
                  onClick={() => setOpen(false)}
                >
                  <FaUser className="h-4 w-4" />
                  {t.navigation?.profile || "My Profile"}
                </Link>
                <Link
                  to="/settings"
                  className="flex items-center gap-2 px-4 py-2 text-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
                  onClick={() => setOpen(false)}
                >
                  <Settings className="h-4 w-4" />
                  {t.navigation?.settings || "Settings"}
                </Link>
                <Link
                  to="/settings?tab=feedback"
                  className="flex items-center gap-2 px-4 py-2 text-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
                  onClick={() => setOpen(false)}
                >
                  <MessageSquare className="h-4 w-4" />
                  {t.navigation?.feedback || "Feedback"}
                </Link>
                <Button
                  variant="ghost"
                  className="w-full justify-start px-4 gap-2"
                  onClick={onLogout}
                >
                  <FaSignOutAlt className="h-4 w-4" />
                  {t.navigation.signOut}
                </Button>
              </>
            ) : (
              <>
                <Link
                  to="/auth"
                  className="flex items-center gap-2 px-4 py-2 text-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
                  onClick={() => setOpen(false)}
                >
                  <FaSignInAlt className="h-4 w-4" />
                  {t.navigation.signIn}
                </Link>
                <Link
                  to="/auth"
                  className="flex items-center gap-2 px-4 py-2 text-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
                  onClick={() => setOpen(false)}
                >
                  <FaUser className="h-4 w-4" />
                  {t.navigation.signUp}
                </Link>
              </>
            )}
          </>
        )}
        <div className="px-4 py-2">
          <LanguageSelector />
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {showEnvBanner && (
        <div
          className={`${
            isSandbox ? "bg-amber-500" : "bg-blue-600"
          } text-white py-1.5 px-3 font-medium`}
        >
          <div className="container mx-auto flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-4">
            <div className="flex items-center gap-2 overflow-hidden flex-none max-w-full">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="text-[10px] sm:text-xs md:text-sm truncate">
                {isSandbox ? t.common.sandboxMode : t.common.devMode}
              </span>
            </div>
            <RoleSwitcher />
          </div>
        </div>
      )}
      <header className="border-b">
        <div className="container mx-auto px-3 sm:px-4">
          <nav className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center space-x-2 text-primary">
              <Cherry className="h-6 w-6 flex-shrink-0" />
              <span className="font-bold text-base md:text-lg">{t.common.appName}</span>
            </Link>

            <div className="flex items-center gap-2 sm:gap-4">
              <ThemeToggle />
              {user && !isAuthPage && (
                <div className="flex-shrink-0 animate-in fade-in slide-in-from-right-4 duration-500">
                  <GrowingTree user={user} isCompact />
                </div>
              )}

              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">{t.navigation.openMenu}</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                  <SheetHeader>
                    <SheetTitle className="flex items-center space-x-2">
                      <Cherry className="h-6 w-6" />
                      <span>{t.common.appName}</span>
                    </SheetTitle>
                    <SheetDescription>{t.navigation.menuDescription}</SheetDescription>
                  </SheetHeader>
                  <div className="mt-8 space-y-2">
                    <NavigationLinks />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8 flex-1">
        {children || <Outlet />}
      </main>
      {/* TODO: Once TOS/Privacy docs are self-hosted, replace Google Docs URLs below with internal routes (e.g. /terms, /privacy) and import corresponding page components in App.tsx */}
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-3 sm:px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <p>
            &copy; {new Date().getFullYear()} Berry Bank, Inc. {t.common.allRightsReserved}
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://docs.google.com/document/d/1z2uFVSLxRA3Nd74C5qRwEO0-S87FW-k-/edit"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              {t.common.termsOfService}
            </a>
            <a
              href="https://docs.google.com/document/d/1WRUei7Ua3kAricHv6KulE_rk_JfqyBAU/edit"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              {t.common.privacyNotice}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
