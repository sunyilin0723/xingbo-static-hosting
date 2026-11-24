import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { TRPCProvider } from "./providers/trpc";
import "./index.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TRPCProvider>
      <App />
    </TRPCProvider>
  </StrictMode>
);
