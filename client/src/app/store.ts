import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../features/auth/authSlice";
import projectReducer from "../features/projects/projectSlice";
import commentReducer from "../features/comments/commentSlice";
import configReducer from "../features/config/configSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    project: projectReducer,
    comment: commentReducer,
    config: configReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
