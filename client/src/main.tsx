import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { ComponentShowcase } from "./showcase/ComponentShowcase";

const params = new URLSearchParams(window.location.search);
const componentId = params.get("component");
const isShowcase = params.has("showcase") || componentId !== null;

createRoot(document.getElementById("root")!).render(
  <StrictMode>{isShowcase ? <ComponentShowcase componentId={componentId} /> : <App />}</StrictMode>,
);
