import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { users, images } from "../../db/schema";
import { storage } from "../lib/storage";

export const imgRoutes = new Hono();

// 图床直链：始终内联显示图片（inline）
imgRoutes.get("/:username/:slug", async (c) => {
  const { username, slug } = c.req.param();
  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.username, username),
  });
  if (!user) return c.body(null, 404);
  const img = await db.query.images.findFirst({
    where: and(eq(images.ownerId, user.id), eq(images.slug, slug)),
  });
  if (!img) return c.body(null, 404);

  let data: Uint8Array<ArrayBuffer>;
  try {
    data = new Uint8Array(await storage.readFile({ fileKey: img.key }));
  } catch (e: any) {
    if (e?.code === "STORAGE_OBJECT_NOT_FOUND") return c.body(null, 404);
    return c.json({ error: "图片读取失败，请稍后重试", code: e?.code || "STORAGE_ERROR" }, 502);
  }
  return c.body(data, 200, {
    "Content-Type": img.contentType,
    "Content-Length": String(data.byteLength),
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(img.name)}`,
    "Cache-Control": "public, max-age=86400, immutable",
    "X-Content-Type-Options": "nosniff",
  });
});
