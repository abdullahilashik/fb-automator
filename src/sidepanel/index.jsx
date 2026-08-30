import React from "react";
import { createRoot } from "react-dom/client";
import Sidepanel from "./Sidepanel";
import "../styles/global.css";
import { Toaster } from "react-hot-toast";

const container = document.getElementById("root");
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <Toaster position="top-center" />
    <Sidepanel />
  </React.StrictMode>
);