// 本地开发入口（Node）：复用 Worker 版同一个 Hono app（./app），加上静态文件服务。
// 生产部署到 Cloudflare Workers 时使用 api/worker-entry.ts。
import app from "./app";
import { log } from "./lib/logger";

if (process.env.NODE_ENV !== "production") {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    log.info(`Server running on http://localhost:${port}/`);
  });
} else {
  // 生产 Node 服务器（非 Workers 部署路径）：只提供 API，不做静态服务
  // （vite.ts 依赖 fs，且静态资源在 Workers 上由 Static Assets 托管）。
  const { serve } = await import("@hono/node-server");
  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    log.info(`API server running on http://localhost:${port}/`);
  });
}

export default app;
