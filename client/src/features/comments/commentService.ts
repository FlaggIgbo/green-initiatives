import { getApiUrl } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/auth-token";

// Get comments for a project
const getComments = async (projectId: string) => {
  const response = await fetch(getApiUrl(`/api/projects/${projectId}/comments`), {
    headers: getAuthHeaders(),
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to fetch comments");
  }

  return await response.json();
};

// Create comment
const createComment = async (
  projectId: string,
  content: string,
  parentCommentId?: string | null,
) => {
  const response = await fetch(getApiUrl(`/api/projects/${projectId}/comments`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ content, parentCommentId }),
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to post comment");
  }

  return await response.json();
};

// Like comment
const likeComment = async (commentId: string) => {
  const response = await fetch(getApiUrl(`/api/comments/${commentId}/like`), {
    method: "PATCH",
    headers: getAuthHeaders(),
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to like comment");
  }

  return await response.json();
};

// Delete comment
const deleteComment = async (commentId: string) => {
  const response = await fetch(getApiUrl(`/api/comments/${commentId}`), {
    method: "DELETE",
    headers: getAuthHeaders(),
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to delete comment");
  }

  return await response.json();
};

// Update comment
const updateComment = async (commentId: string, content: string) => {
  const response = await fetch(getApiUrl(`/api/comments/${commentId}`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ content }),
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to update comment");
  }

  return await response.json();
};

// Flag comment
const flagComment = async (commentId: string, reason: string) => {
  const response = await fetch(getApiUrl(`/api/comments/${commentId}/flag`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ reason }),
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to flag comment");
  }

  return await response.json();
};

const commentService = {
  getComments,
  createComment,
  likeComment,
  deleteComment,
  updateComment,
  flagComment,
};

export default commentService;
