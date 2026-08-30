import React from "react";
import { createRoot } from "react-dom/client";
import Popup from "./Popup";
import "@/styles/global.css";
import { Toaster } from "react-hot-toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const container = document.getElementById("root");
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      <Toaster />
      <Popup />
    </QueryClientProvider>
  </React.StrictMode>,
);