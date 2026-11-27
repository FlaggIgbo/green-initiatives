import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import commentService from "./commentService";
import type { Comment } from "@shared/schema-mongo";

interface CommentState {
  comments: Comment[];
  count: number;
  isError: boolean;
  isSuccess: boolean;
  isLoading: boolean;
  message: string;
}

const initialState: CommentState = {
  comments: [],
  count: 0,
  isError: false,
  isSuccess: false,
  isLoading: false,
  message: "",
};

// Get project comments
export const getComments = createAsyncThunk(
  "comments/getAll",
  async (projectId: string, thunkAPI) => {
    try {
      return await commentService.getComments(projectId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Create comment
export const createComment = createAsyncThunk(
  "comments/create",
  async (
    {
      projectId,
      content,
      parentCommentId,
    }: { projectId: string; content: string; parentCommentId?: string | null },
    thunkAPI,
  ) => {
    try {
      return await commentService.createComment(projectId, content, parentCommentId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Like comment
export const likeComment = createAsyncThunk(
  "comments/like",
  async (commentId: string, thunkAPI) => {
    try {
      return await commentService.likeComment(commentId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Delete comment
export const deleteComment = createAsyncThunk(
  "comments/delete",
  async (commentId: string, thunkAPI) => {
    try {
      await commentService.deleteComment(commentId);
      return commentId;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Update comment
export const updateComment = createAsyncThunk(
  "comments/update",
  async ({ commentId, content }: { commentId: string; content: string }, thunkAPI) => {
    try {
      return await commentService.updateComment(commentId, content);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Flag comment
export const flagComment = createAsyncThunk(
  "comments/flag",
  async ({ commentId, reason }: { commentId: string; reason: string }, thunkAPI) => {
    try {
      return await commentService.flagComment(commentId, reason);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

export const commentSlice = createSlice({
  name: "comment",
  initialState,
  reducers: {
    reset: (state) => {
      state.isError = false;
      state.isSuccess = false;
      state.isLoading = false;
      state.message = "";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getComments.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getComments.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.comments = action.payload.comments;
        state.count = action.payload.count;
      })
      .addCase(getComments.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload as string;
      })
      .addCase(createComment.fulfilled, (state, action) => {
        state.comments.unshift(action.payload);
        state.count += 1;
      })
      .addCase(deleteComment.fulfilled, (state, action) => {
        state.comments = state.comments.filter((c) => c.id !== action.payload);
        state.count -= 1;
      })
      .addCase(updateComment.fulfilled, (state, action) => {
        const index = state.comments.findIndex((c) => c.id === action.payload.id);
        if (index !== -1) {
          state.comments[index] = action.payload;
        }
      })
      .addCase(likeComment.fulfilled, (state, action) => {
        const index = state.comments.findIndex((c) => c.id === action.payload.id);
        if (index !== -1) {
          state.comments[index] = action.payload;
        }
      });
  },
});

export const { reset } = commentSlice.actions;
export default commentSlice.reducer;
