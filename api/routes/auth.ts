import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { users } from "../../db/schema";
import {
  hashPassword,
  verifyPassword,
  signToken,
  AUTH_COOKIE,
} from "../lib/auth";

export const authRoutes = new Hono();

const usernameSchema = z
  .string()
  .regex(/^[a-zA-Z0-9_-]{3,20}$/, "用户名为 3-20 位字母、数字、_ 或 -");
const passwordSchema = z
  .string()
  .min(8, "密码至少 8 位")
  .max(72, "密码过长");

function setAuthCookie(c: any, token: string) {
  c.header(
    "Set-Cookie",
    `${AUTH_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 86400}`,
  );
}

authRoutes.post("/register", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = z
    .object({ username: usernameSchema, password: passwordSchema })
    .safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || "参数错误" }, 400);
  }
  const { username, password } = parsed.data;
  const db = getDb();
  const existing = await db.query.users.findFirst({
    where: eq(users.username, username),
  });
  if (existing) return c.json({ error: "用户名已被注册" }, 409);
  const result = await db
    .insert(users)
    .values({ username, passwordHash: hashPassword(password) });
  const insertId = Number(
    (result as unknown as { insertId: bigint }).insertId ??
      (result as unknown as [{ insertId: bigint }])[0]?.insertId,
  );
  const token = signToken(insertId, username);
  setAuthCookie(c, token);
  return c.json({ user: { id: insertId, username }, token });
});

authRoutes.post("/login", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = z
    .object({ username: z.string(), password: z.string() })
    .safeParse(body);
  if (!parsed.success) return c.json({ error: "参数错误" }, 400);
  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.username, parsed.data.username),
  });
  if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
    return c.json({ error: "用户名或密码错误" }, 401);
  }
  const token = signToken(user.id, user.username);
  setAuthCookie(c, token);
  return c.json({ user: { id: user.id, username: user.username }, token });
});

authRoutes.post("/logout", (c) => {
  c.header(
    "Set-Cookie",
    `${AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
  return c.json({ ok: true });
});
