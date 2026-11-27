import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { getApiUrl } from "@/lib/api-config";

interface ConfigState {
  stripeDisabled: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: ConfigState = {
  stripeDisabled: false,
  isLoading: false,
  error: null,
};

export const getConfig = createAsyncThunk("config/getConfig", async (_, thunkAPI) => {
  try {
    const response = await fetch(getApiUrl("/api/config"));
    if (!response.ok) {
      throw new Error("Failed to fetch configuration");
    }
    return await response.json();
  } catch (error) {
    const message = error instanceof Error ? error.message : "An error occurred";
    return thunkAPI.rejectWithValue(message);
  }
});

const configSlice = createSlice({
  name: "config",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(getConfig.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getConfig.fulfilled, (state, action) => {
        state.isLoading = false;
        state.stripeDisabled = action.payload.stripeDisabled;
      })
      .addCase(getConfig.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export default configSlice.reducer;
