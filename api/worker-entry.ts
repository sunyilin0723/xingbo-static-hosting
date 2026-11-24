// Cloudflare Worker entry point.
//
// Bindings arrive on the fetch handler's env; the rest of the app (drizzle
// connection, R2 storage) reads them from globalThis, stashed here on every
// request. Static frontend assets are served from the Workers Static Assets
// binding (ASSETS) with SPA fallback to index.html.

export interface WorkerEnv {
  DB: D1Database;
  BUCKET: R2Bucket;
  ASSETS: Fetcher;
  APP_SECRET: string;
}

import app from "./app";

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext) {
    (globalThis as any).__D1 = env.DB;
    (globalThis as any).__R2 = env.BUCKET;

    const url = new URL(request.url);
    if (
      url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/public/") ||
      url.pathname.startsWith("/i/")
    ) {
      return app.fetch(request, env, ctx);
    }

    let res = await env.ASSETS.fetch(request);
    if (res.status === 404) {
      res = await env.ASSETS.fetch(
        new Request(new URL("/index.html", request.url), request),
      );
    }
    return res;
  },
};
