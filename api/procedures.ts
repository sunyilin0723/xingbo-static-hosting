import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getTokenFromRequest, verifyToken } from "./lib/auth";
import { getDb } from "./queries/connection";
import { users } from "../db/schema";

// userProcedure: requires a valid JWT and loads the user into ctx.user.
export const userProcedure = publicQuery.use(async ({ ctx, next }) => {
  const token = getTokenFromRequest(ctx.req);
  const payload = token && verifyToken(token);
  if (!payload) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "请先登录" });
  }
  const user = await getDb().query.users.findFirst({
    where: eq(users.id, payload.uid),
  });
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "账号不存在" });
  }
  return next({
    ctx: { user: { id: user.id, username: user.username } },
  });
});
