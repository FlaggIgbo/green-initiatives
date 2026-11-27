import {
  createSlice,
  createAsyncThunk,
  createEntityAdapter,
  createSelector,
  EntityState,
} from "@reduxjs/toolkit";
import projectService from "./projectService";
import type { Project, Organization } from "@shared/schema-mongo";
import type { RootState } from "../../app/store";

const projectsAdapter = createEntityAdapter<Project>({
  sortComparer: (a, b) => b.createdAt.toString().localeCompare(a.createdAt.toString()),
});

interface ProjectState extends EntityState<Project, string> {
  myProjectIds: string[];
  currentProject: Project | null;
  organizations: Organization[];
  isError: boolean;
  isSuccess: boolean;
  isLoading: boolean;
  message: string;
  lastFetched: number | null;
}

const initialState: ProjectState = projectsAdapter.getInitialState({
  myProjectIds: [],
  currentProject: null,
  organizations: [],
  isError: false,
  isSuccess: false,
  isLoading: false,
  message: "",
  lastFetched: null,
});

// Create new project
export const createProject = createAsyncThunk(
  "projects/create",
  async (projectData: Partial<Project>, thunkAPI) => {
    try {
      return await projectService.createProject(projectData);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Get projects
export const getProjects = createAsyncThunk(
  "projects/getAll",
  async (options: { force?: boolean } | undefined, thunkAPI) => {
    try {
      const state = thunkAPI.getState() as RootState;
      const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

      // Basic caching logic using adapter's IDs
      if (
        !options?.force &&
        state.project.ids.length > 0 &&
        state.project.lastFetched &&
        Date.now() - state.project.lastFetched < CACHE_DURATION
      ) {
        // Return existing projects from state
        return Object.values(state.project.entities).filter(Boolean) as Project[];
      }

      return await projectService.getProjects();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Get single project
export const getProject = createAsyncThunk("projects/getOne", async (id: string, thunkAPI) => {
  try {
    return await projectService.getProject(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return thunkAPI.rejectWithValue(message);
  }
});

// Get my projects
export const getMyProjects = createAsyncThunk("projects/getMy", async (_, thunkAPI) => {
  try {
    return await projectService.getMyProjects();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return thunkAPI.rejectWithValue(message);
  }
});

// Update progress
export const updateProjectProgress = createAsyncThunk(
  "projects/updateProgress",
  async ({ id, progress }: { id: string; progress: number }, thunkAPI) => {
    try {
      return await projectService.updateProjectProgress(id, progress);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Get organizations
export const getOrganizations = createAsyncThunk(
  "projects/getOrganizations",
  async (_, thunkAPI) => {
    try {
      return await projectService.getOrganizations();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Delete project
export const deleteProject = createAsyncThunk("projects/delete", async (id: string, thunkAPI) => {
  try {
    await projectService.deleteProject(id);
    return id;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return thunkAPI.rejectWithValue(message);
  }
});

// Update project
export const updateProject = createAsyncThunk(
  "projects/update",
  async ({ id, projectData }: { id: string; projectData: Partial<Project> }, thunkAPI) => {
    try {
      return await projectService.updateProject(id, projectData);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Update approval status
export const updateProjectApprovalStatus = createAsyncThunk(
  "projects/updateApprovalStatus",
  async ({ id, status }: { id: string; status: string }, thunkAPI) => {
    try {
      return await projectService.updateApprovalStatus(id, status);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

export const projectSlice = createSlice({
  name: "project",
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
      .addCase(createProject.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(createProject.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        projectsAdapter.addOne(state, action.payload);
      })
      .addCase(createProject.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload as string;
      })
      .addCase(getProjects.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getProjects.fulfilled, (state, action) => {
        state.isLoading = false;
        projectsAdapter.setAll(state, action.payload);
        state.lastFetched = Date.now();
      })
      .addCase(getProjects.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload as string;
      })
      .addCase(getProject.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getProject.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentProject = action.payload;
        projectsAdapter.upsertOne(state, action.payload);
      })
      .addCase(getProject.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload as string;
      })
      .addCase(getMyProjects.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getMyProjects.fulfilled, (state, action) => {
        state.isLoading = false;
        projectsAdapter.upsertMany(state, action.payload);
        state.myProjectIds = action.payload.map((p: Project) => p.id);
      })
      .addCase(getMyProjects.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload as string;
      })
      .addCase(deleteProject.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(deleteProject.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        projectsAdapter.removeOne(state, action.payload);
        state.myProjectIds = state.myProjectIds.filter((id) => id !== action.payload);
      })
      .addCase(deleteProject.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload as string;
      })
      .addCase(updateProject.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(updateProject.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        projectsAdapter.updateOne(state, {
          id: action.payload.id,
          changes: action.payload,
        });
        if (state.currentProject && state.currentProject.id === action.payload.id) {
          state.currentProject = action.payload;
        }
      })
      .addCase(updateProject.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload as string;
      })
      .addCase(updateProjectApprovalStatus.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        projectsAdapter.updateOne(state, {
          id: action.payload.id,
          changes: action.payload,
        });
        if (state.currentProject && state.currentProject.id === action.payload.id) {
          state.currentProject = action.payload;
        }
      })
      .addCase(updateProjectProgress.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        projectsAdapter.updateOne(state, {
          id: action.meta.arg.id,
          changes: { progress: action.meta.arg.progress },
        });
        if (state.currentProject && state.currentProject.id === action.meta.arg.id) {
          state.currentProject.progress = action.meta.arg.progress;
        }
      })
      .addCase(getOrganizations.fulfilled, (state, action) => {
        state.organizations = action.payload;
      });
  },
});

export const {
  selectAll: selectAllProjects,
  selectById: selectProjectById,
  selectIds: selectProjectIds,
} = projectsAdapter.getSelectors((state: RootState) => state.project);

// Custom selector for "My Projects" (memoized to avoid unnecessary rerenders)
const selectProjectState = (state: RootState) => state.project;
export const selectMyProjects = createSelector([selectProjectState], (projectState) => {
  const { myProjectIds, entities } = projectState;
  return myProjectIds.map((id) => entities[id]).filter(Boolean) as Project[];
});

export const { reset } = projectSlice.actions;
export default projectSlice.reducer;
