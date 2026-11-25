import path from "path"
const __dirname = import.meta.dirname
import react from "@vitejs/plugin-react"
import legacy from "@vitejs/plugin-legacy"
import { defineConfig } from "vite"

// Workers 分支的 vite 配置：去掉了 dev-server 与平台预览插件
// （@hono/vite-dev-server / kimi-plugin-inspect-react 不在依赖里，且仅本地开发需要）。
// 本配置只用于 `vite build` 产出 dist/public 静态资源。
export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ["defaults", "Chrome >= 49", "Firefox >= 52", "Safari >= 10", "Edge >= 15", "iOS >= 10", "Android >= 5"],
      polyfills: true,
      modernPolyfills: false,
    }),
  ],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@contracts": path.resolve(__dirname, "./contracts"),
      "@db": path.resolve(__dirname, "./db"),
      "db": path.resolve(__dirname, "./db"),
    },
  },
  envDir: path.resolve(__dirname),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
});
