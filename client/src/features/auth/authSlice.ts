import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import authService from "./authService";
import type { User, UserRole, Contribution } from "@shared/schema-mongo";

// Get user from sessionStorage
const userString = sessionStorage.getItem("user");
const user = userString ? JSON.parse(userString) : null;

interface AuthState {
  user: User | null;
  contributions: Contribution[];
  isError: boolean;
  isSuccess: boolean;
  isLoading: boolean;
  isAuthChecked: boolean;
  message: string;
  requiresOTP: boolean;
  otpUserId: string | null;
}

const initialState: AuthState = {
  user: user ? user : null,
  contributions: [],
  isError: false,
  isSuccess: false,
  isLoading: false,
  isAuthChecked: false,
  message: "",
  requiresOTP: false,
  otpUserId: null,
};

// Register user
export const register = createAsyncThunk(
  "auth/register",
  async (
    userData: {
      username: string;
      password: string;
      fullName?: string;
      email?: string;
      phoneNumber?: string;
      role?: UserRole;
    },
    thunkAPI,
  ) => {
    try {
      return await authService.register(userData);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Login user
export const login = createAsyncThunk(
  "auth/login",
  async (userData: { username: string; password: string }, thunkAPI) => {
    try {
      return await authService.login(userData);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Verify OTP
export const verifyOTP = createAsyncThunk(
  "auth/verifyOTP",
  async (otpData: { userId: string; otp: string }, thunkAPI) => {
    try {
      return await authService.verifyOTP(otpData);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Resend OTP
export const resendOTP = createAsyncThunk("auth/resendOTP", async (userId: string, thunkAPI) => {
  try {
    return await authService.resendOTP(userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return thunkAPI.rejectWithValue(message);
  }
});

// Logout user
export const logout = createAsyncThunk("auth/logout", async () => {
  return await authService.logout();
});

// Update roundup settings
export const updateRoundupSettings = createAsyncThunk(
  "auth/updateRoundup",
  async (
    arg: boolean | { enabled: boolean; projectId?: string; projectIds?: string[] },
    thunkAPI,
  ) => {
    try {
      if (typeof arg === "boolean") {
        return await authService.updateRoundupSettings(arg);
      }
      const { enabled, projectId, projectIds } = arg;
      return await authService.updateRoundupSettings(enabled, { projectId, projectIds });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Water tree
export const waterTree = createAsyncThunk("auth/waterTree", async (_, thunkAPI) => {
  try {
    return await authService.waterTree();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return thunkAPI.rejectWithValue(message);
  }
});

// Check auth session against server (called on app startup / hard refresh)
export const checkAuth = createAsyncThunk("auth/checkAuth", async (_, thunkAPI) => {
  try {
    return await authService.getCurrentUser();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return thunkAPI.rejectWithValue(message);
  }
});

// Update preferred currency
export const updatePreferredCurrency = createAsyncThunk(
  "auth/updatePreferredCurrency",
  async (currency: string, thunkAPI) => {
    try {
      return await authService.updatePreferredCurrency(currency);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Get contributions
export const getContributions = createAsyncThunk("auth/getContributions", async (_, thunkAPI) => {
  try {
    return await authService.getContributions();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return thunkAPI.rejectWithValue(message);
  }
});

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    reset: (state) => {
      state.isLoading = false;
      state.isSuccess = false;
      state.isError = false;
      state.message = "";
      state.requiresOTP = false;
      state.otpUserId = null;
    },
    setRole: (state, action: PayloadAction<UserRole>) => {
      if (state.user) {
        state.user.role = action.payload;
        sessionStorage.setItem("user", JSON.stringify(state.user));
        sessionStorage.setItem("roleOverride", action.payload);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(register.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.user = action.payload.user;
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload as string;
        state.user = null;
      })
      .addCase(login.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload.requiresOTP) {
          state.requiresOTP = true;
          state.otpUserId = action.payload.userId;
          state.message = action.payload.message;
        } else {
          state.isSuccess = true;
          state.user = action.payload.user;
          state.requiresOTP = false;
          state.otpUserId = null;
        }
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload as string;
        state.user = null;
      })
      .addCase(verifyOTP.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(verifyOTP.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.user = action.payload.user;
        state.requiresOTP = false;
        state.otpUserId = null;
      })
      .addCase(verifyOTP.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload as string;
      })
      .addCase(resendOTP.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(resendOTP.fulfilled, (state, action) => {
        state.isLoading = false;
        state.message = action.payload.message;
      })
      .addCase(resendOTP.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload as string;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.isSuccess = false;
        state.isError = false;
        state.isLoading = false;
        state.message = "";
        sessionStorage.removeItem("roleOverride");
      })
      .addCase(logout.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload as string;
        state.user = null;
      })
      .addCase(updateRoundupSettings.fulfilled, (state, action) => {
        if (state.user) {
          const arg = action.meta.arg;
          state.user.roundUpEnabled = typeof arg === "boolean" ? arg : arg.enabled;
          if (typeof arg === "object" && arg.projectIds !== undefined) {
            state.user.roundUpProjectIds = arg.projectIds;
          }
        }
      })
      .addCase(updatePreferredCurrency.fulfilled, (state, action) => {
        if (action.payload) {
          state.user = action.payload;
        }
      })
      .addCase(waterTree.fulfilled, (state, action) => {
        if (state.user) {
          state.user.points = action.payload.points;
          state.user.treeGrowth = action.payload.treeGrowth;
          state.user.sunwaterCoins = action.payload.sunwaterCoins;
        }
      })
      .addCase(getContributions.fulfilled, (state, action) => {
        state.contributions = action.payload;
      })
      .addCase(checkAuth.pending, (state) => {
        state.isAuthChecked = false;
      })
      .addCase(checkAuth.fulfilled, (state, action) => {
        state.isAuthChecked = true;
        state.user = action.payload;
        const roleOverride = sessionStorage.getItem("roleOverride") as UserRole | null;
        if (state.user && roleOverride) {
          state.user.role = roleOverride;
        }
      })
      .addCase(checkAuth.rejected, (state) => {
        state.isAuthChecked = true;
        state.user = null;
      });
  },
});

export const { reset, setRole } = authSlice.actions;
export default authSlice.reducer;
