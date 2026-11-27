import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../features/auth/authSlice";
import { Layout } from "./layout";

/**
 * Test suite for layout.tsx
 * Tests role-based navigation rendering
 */

// Mock dependencies
jest.mock("react-router-dom", () => ({
  Link: ({ children, to }) => <a href={to}>{children}</a>,
  useLocation: () => ({ pathname: "/projects" }),
  useNavigate: () => jest.fn(),
}));

jest.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false, // Test desktop navigation by default
}));

jest.mock("@/hooks/use-translation", () => ({
  useTranslation: () => ({
    t: {
      navigation: {
        home: "Home",
        projects: "Projects",
        dashboard: "Dashboard",
        createProject: "Create Project",
        signIn: "Sign In",
        signUp: "Sign Up",
        signOut: "Sign Out",
        openMenu: "Open menu",
        profile: "My Profile",
        settings: "Settings",
        menuDescription: "Navigation menu",
      },
      common: {
        loading: "Loading...",
        appName: "Berry Bank Green Hub",
      },
    },
  }),
}));

jest.mock("./growing-tree", () => ({
  GrowingTree: ({ user }) => <div>GrowingTree-{user.username}</div>,
}));

jest.mock("./language-selector", () => ({
  LanguageSelector: () => <div>LanguageSelector</div>,
}));

jest.mock("./theme-toggle", () => ({
  ThemeToggle: () => <button>ThemeToggle</button>,
}));

describe("Layout Navigation - Role-Based Access Control", () => {
  let store;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderWithProviders = (ui, { user = null } = {}) => {
    store = configureStore({
      reducer: {
        auth: authReducer,
      },
      preloadedState: {
        auth: {
          user,
          contributions: [],
          isError: false,
          isSuccess: false,
          isLoading: false,
          message: "",
        },
      },
    });

    return render(<Provider store={store}>{ui}</Provider>);
  };

  describe("Admin Role", () => {
    it("should show Projects, Dashboard, and Create Project links", () => {
      const mockAdmin = {
        id: "1",
        username: "admin-user",
        password: "hashed",
        role: "admin",
        points: 100,
        treeGrowth: 50,
        sunwaterCoins: 25,
        allowedEnvironment: "development",
        roundUpEnabled: false,
        createdAt: new Date(),
      };

      renderWithProviders(
        <Layout>
          <div>Test Content</div>
        </Layout>,
        { user: mockAdmin },
      );

      // Open the hamburger menu
      const menuButton = screen.getByRole("button", { name: /open menu/i });
      fireEvent.click(menuButton);

      // Should see all navigation links including Dashboard
      expect(screen.getByText("Projects")).toBeInTheDocument();
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
      expect(screen.getByText("Create Project")).toBeInTheDocument();

      // Should see user-specific elements
      expect(screen.getByText("GrowingTree-admin-user")).toBeInTheDocument();
      expect(screen.getByText("Sign Out")).toBeInTheDocument();

      // Should NOT see sign in
      expect(screen.queryByText("Sign In")).not.toBeInTheDocument();
    });
  });

  describe("Entity Role", () => {
    it("should NOT show Projects link, but show Dashboard and Create Project links", () => {
      const mockEntity = {
        id: "2",
        username: "entity-org",
        password: "hashed",
        role: "entity",
        points: 200,
        treeGrowth: 75,
        sunwaterCoins: 50,
        allowedEnvironment: "sandbox",
        roundUpEnabled: false,
        createdAt: new Date(),
      };

      renderWithProviders(
        <Layout>
          <div>Test Content</div>
        </Layout>,
        { user: mockEntity },
      );

      // Open the hamburger menu
      const menuButton = screen.getByRole("button", { name: /open menu/i });
      fireEvent.click(menuButton);

      // Should NOT see Projects link (entity users don't have access)
      expect(screen.queryByText("Projects")).not.toBeInTheDocument();

      // Should see Dashboard and Create Project
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
      expect(screen.getByText("Create Project")).toBeInTheDocument();

      // Should see user-specific elements
      expect(screen.getByText("GrowingTree-entity-org")).toBeInTheDocument();
      expect(screen.getByText("Sign Out")).toBeInTheDocument();

      // Should NOT see sign in
      expect(screen.queryByText("Sign In")).not.toBeInTheDocument();
    });
  });

  describe("User Role (Berry Bank Customer)", () => {
    it("should show only Projects link, NOT Dashboard or Create Project", () => {
      const mockUser = {
        id: "3",
        username: "customer-user",
        password: "hashed",
        role: "user",
        points: 50,
        treeGrowth: 20,
        sunwaterCoins: 10,
        allowedEnvironment: "production",
        roundUpEnabled: false,
        createdAt: new Date(),
      };

      renderWithProviders(
        <Layout>
          <div>Test Content</div>
        </Layout>,
        { user: mockUser },
      );

      // Open the hamburger menu
      const menuButton = screen.getByRole("button", { name: /open menu/i });
      fireEvent.click(menuButton);

      // Should see Projects link
      expect(screen.getByText("Projects")).toBeInTheDocument();

      // Should NOT see Dashboard or Create Project links
      expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
      expect(screen.queryByText("Create Project")).not.toBeInTheDocument();

      // Should see user-specific elements
      expect(screen.getByText("GrowingTree-customer-user")).toBeInTheDocument();
      expect(screen.getByText("Sign Out")).toBeInTheDocument();

      // Should NOT see sign in
      expect(screen.queryByText("Sign In")).not.toBeInTheDocument();
    });
  });

  describe("Not Authenticated (No User)", () => {
    it("should show Sign In and Sign Up links, but NOT Dashboard, Create Project, or Projects", () => {
      renderWithProviders(
        <Layout>
          <div>Test Content</div>
        </Layout>,
      );

      // Open the hamburger menu
      const menuButton = screen.getByRole("button", { name: /open menu/i });
      fireEvent.click(menuButton);

      // Should see Sign In, Sign Up, and Projects (unauthenticated nav)
      expect(screen.getByText("Sign In")).toBeInTheDocument();
      expect(screen.getByText("Sign Up")).toBeInTheDocument();
      expect(screen.getByText("Projects")).toBeInTheDocument();

      // Should NOT see Dashboard or Create Project
      expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
      expect(screen.queryByText("Create Project")).not.toBeInTheDocument();

      // Should NOT see user-specific elements
      expect(screen.queryByText(/GrowingTree/)).not.toBeInTheDocument();
      expect(screen.queryByText("Sign Out")).not.toBeInTheDocument();
    });
  });

  describe("Role-based Navigation Summary", () => {
    it("should correctly map roles to navigation visibility", async () => {
      const testCases = [
        {
          role: "admin",
          shouldSeeProjects: true,
          shouldSeeDashboard: true,
          shouldSeeCreateProject: true,
          description: "Admin users can access dashboard and create projects",
        },
        {
          role: "entity",
          shouldSeeProjects: false,
          shouldSeeDashboard: true,
          shouldSeeCreateProject: true,
          description:
            "Entity users (organizations) can access dashboard and create projects but not projects",
        },
        {
          role: "user",
          shouldSeeProjects: true,
          shouldSeeDashboard: false,
          shouldSeeCreateProject: false,
          description: "Regular users (customers) cannot access dashboard or create projects",
        },
        {
          role: null,
          shouldSeeProjects: true,
          shouldSeeDashboard: false,
          shouldSeeCreateProject: false,
          description:
            "Unauthenticated users see Sign In/Sign Up and Projects, but not Dashboard/Create",
        },
      ];

      for (const testCase of testCases) {
        const mockUser = testCase.role
          ? {
              id: testCase.role,
              username: `${testCase.role}-user`,
              password: "hashed",
              role: testCase.role,
              points: 0,
              treeGrowth: 0,
              sunwaterCoins: 0,
              allowedEnvironment: "sandbox",
              roundUpEnabled: false,
              createdAt: new Date(),
            }
          : null;

        const { unmount } = renderWithProviders(
          <Layout>
            <div>Test Content</div>
          </Layout>,
          { user: mockUser },
        );

        // Open the hamburger menu
        const menuButton = screen.getByRole("button", { name: /open menu/i });
        fireEvent.click(menuButton);

        // Wait for Sheet to open and navigation links to render
        await waitFor(() => {
          const projectsLink = screen.queryByText("Projects");
          const dashboardLink = screen.queryByText("Dashboard");
          const createProjectLink = screen.queryByText("Create Project");

          if (testCase.shouldSeeProjects) {
            expect(projectsLink).toBeInTheDocument();
          } else {
            expect(projectsLink).not.toBeInTheDocument();
          }

          if (testCase.shouldSeeDashboard) {
            expect(dashboardLink).toBeInTheDocument();
          } else {
            expect(dashboardLink).not.toBeInTheDocument();
          }

          if (testCase.shouldSeeCreateProject) {
            expect(createProjectLink).toBeInTheDocument();
          } else {
            expect(createProjectLink).not.toBeInTheDocument();
          }
        });

        unmount();
      }
    });
  });
});
