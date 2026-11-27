import { getApiUrl } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/auth-token";
import type { Project } from "@shared/schema-mongo";

// Create project
const createProject = async (projectData: Partial<Project>) => {
  const response = await fetch(getApiUrl("/api/projects"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(projectData),
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to create project");
  }

  return await response.json();
};

// Get all projects
const getProjects = async () => {
  const response = await fetch(getApiUrl("/api/projects"), {
    headers: getAuthHeaders(),
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to fetch projects");
  }

  return await response.json();
};

// Get single project
const getProject = async (id: string) => {
  const response = await fetch(getApiUrl(`/api/projects/${id}`), {
    headers: getAuthHeaders(),
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to fetch project");
  }

  return await response.json();
};

// Get my projects
const getMyProjects = async () => {
  const response = await fetch(getApiUrl("/api/my-projects"), {
    headers: getAuthHeaders(),
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to fetch your projects");
  }

  return await response.json();
};

// Update project progress
const updateProjectProgress = async (id: string, progress: number) => {
  const response = await fetch(getApiUrl(`/api/projects/${id}/progress`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ progress }),
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to update progress");
  }

  return await response.json();
};

// Get organizations
const getOrganizations = async () => {
  const response = await fetch(getApiUrl("/api/organizations"), {
    headers: getAuthHeaders(),
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to fetch organizations");
  }

  return await response.json();
};

// Delete project
const deleteProject = async (id: string) => {
  const response = await fetch(getApiUrl(`/api/projects/${id}`), {
    method: "DELETE",
    headers: getAuthHeaders(),
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to delete project");
  }

  return await response.json();
};

// Update project
const updateProject = async (id: string, projectData: Partial<Project>) => {
  const response = await fetch(getApiUrl(`/api/projects/${id}`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(projectData),
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to update project");
  }

  return await response.json();
};

// Update project approval status (Admin only)
const updateApprovalStatus = async (id: string, status: string) => {
  const response = await fetch(getApiUrl(`/api/projects/${id}/approval`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ status }),
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to update approval status");
  }

  return await response.json();
};

const projectService = {
  createProject,
  getProjects,
  getProject,
  getMyProjects,
  updateProjectProgress,
  getOrganizations,
  deleteProject,
  updateProject,
  updateApprovalStatus,
};

export default projectService;
