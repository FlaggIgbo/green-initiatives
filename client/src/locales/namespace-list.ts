/**
 * List of translation namespaces (one per JSON file per locale).
 * Used for lazy-loading and validation.
 */
export const NAMESPACES = [
  "common",
  "navigation",
  "home",
  "projects",
  "projectDetails",
  "createProject",
  "auth",
  "categories",
  "status",
  "accountType",
  "dashboard",
  "validation",
  "growingTree",
  "profile",
  "comments",
  "settings",
  "forgotPassword",
  "resetPassword",
  "registerEntity",
  "notFound",
  "errorBoundary",
  "projectSidebar",
  "projectInfo",
  "progressIndicator",
  "errors",
] as const;

export type Namespace = (typeof NAMESPACES)[number];
