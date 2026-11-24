import { createRouter, publicQuery } from "./middleware";
import { filesRouter } from "./files-router";
import { imagesRouter } from "./images-router";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  files: filesRouter,
  images: imagesRouter,
});

export type AppRouter = typeof appRouter;
