import { initTRPC } from "@trpc/server";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicQuery = t.procedure;

export function createRouter<R extends Parameters<typeof router>[0]>(routes: R) {
  return router(routes);
}
