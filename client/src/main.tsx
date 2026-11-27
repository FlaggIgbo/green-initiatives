import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "./app/store";
import App from "./app/App";
import "./app/index.css";
import "leaflet/dist/leaflet.css";
import { setupGlobalErrorHandlers } from "./lib/logger";
import { ErrorBoundary } from "./components/error-boundary";

// Set up global error handlers for unhandled errors and promise rejections
setupGlobalErrorHandlers();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <Provider store={store}>
      <App />
    </Provider>
  </ErrorBoundary>,
);
