import { getApiUrl } from "@/lib/api-config";
import { getAuthHeaders, setAuthToken, clearAuthToken } from "@/lib/auth-token";

// Register user
const register = async (userData: {
  username: string;
  password: string;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  role?: string;
}) => {
  const response = await fetch(getApiUrl("/api/register"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(userData),
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Registration failed");
  }

  const data = await response.json();
  if (data && data.user) {
    sessionStorage.setItem("user", JSON.stringify(data.user));
  }
  if (data?.token) {
    setAuthToken(data.token);
  }

  return data;
};

// Login user
const login = async (userData: { username: string; password: string }) => {
  const response = await fetch(getApiUrl("/api/login"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(userData),
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Login failed");
  }

  const data = await response.json();
  if (data && data.user) {
    sessionStorage.setItem("user", JSON.stringify(data.user));
  }
  if (data?.token) {
    setAuthToken(data.token);
  }

  return data;
};

// Logout user
const logout = async () => {
  await fetch(getApiUrl("/api/logout"), {
    method: "POST",
    credentials: "include",
    headers: getAuthHeaders(),
  });
  sessionStorage.removeItem("user");
  clearAuthToken();
};

// Update roundup settings
const updateRoundupSettings = async (
  enabled: boolean,
  options?: { projectId?: string; projectIds?: string[] },
) => {
  const body: { enabled: boolean; projectId?: string; projectIds?: string[] } = { enabled };
  if (options?.projectIds !== undefined) body.projectIds = options.projectIds;
  else if (options?.projectId !== undefined) body.projectId = options.projectId;

  const response = await fetch(getApiUrl("/api/user/roundup-settings"), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(body),
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to update settings");
  }

  return await response.json();
};

// Update preferred currency
const updatePreferredCurrency = async (currency: string) => {
  const response = await fetch(getApiUrl("/api/user/preferred-currency"), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ preferredCurrency: currency }),
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to update currency");
  }

  const user = await response.json();
  if (user) sessionStorage.setItem("user", JSON.stringify(user));
  return user;
};

// Water tree
const waterTree = async () => {
  const response = await fetch(getApiUrl("/api/user/water-tree"), {
    method: "POST",
    headers: getAuthHeaders(),
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to water tree");
  }

  return await response.json();
};

// Get user contributions
const getContributions = async () => {
  const response = await fetch(getApiUrl("/api/user/contributions"), {
    headers: getAuthHeaders(),
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to fetch contributions");
  }

  return await response.json();
};

// Validate current session by calling the server.
// Returns the user object when logged in, or null when not.
const getCurrentUser = async () => {
  const response = await fetch(getApiUrl("/api/user"), {
    headers: getAuthHeaders(),
    credentials: "include",
  });

  if (!response.ok) {
    // A real server error (5xx, etc.) — clear stale cache and surface it
    sessionStorage.removeItem("user");
    throw new Error("Session check failed");
  }

  const data = await response.json();

  if (data) {
    // Keep sessionStorage in sync with the server's truth
    sessionStorage.setItem("user", JSON.stringify(data));
  } else {
    // Server returned null — user is not logged in
    sessionStorage.removeItem("user");
  }

  return data;
};

// Verify OTP
const verifyOTP = async (otpData: { userId: string; otp: string }) => {
  const response = await fetch(getApiUrl("/api/auth/verify-otp"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(otpData),
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "OTP verification failed");
  }

  const data = await response.json();
  if (data && data.user) {
    sessionStorage.setItem("user", JSON.stringify(data.user));
  }
  return data;
};

// Resend OTP
const resendOTP = async (userId: string) => {
  const response = await fetch(getApiUrl("/api/auth/resend-otp"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to resend OTP");
  }

  return await response.json();
};

const authService = {
  register,
  logout,
  login,
  verifyOTP,
  resendOTP,
  getCurrentUser,
  updateRoundupSettings,
  updatePreferredCurrency,
  waterTree,
  getContributions,
};

export default authService;
