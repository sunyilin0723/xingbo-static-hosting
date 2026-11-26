import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { TRPCProvider } from "./providers/trpc";
import "./index.css";

// 旧版 Service Worker 会缓存旧页面导致 stuck，这里统一注销并清空缓存
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
    if ("caches" in window) {
      caches.keys().then((ks) => ks.forEach((k) => caches.delete(k)));
    }
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TRPCProvider>
      <App />
    </TRPCProvider>
  </StrictMode>
);
