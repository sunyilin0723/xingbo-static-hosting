import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { files, users } from "../../db/schema";
import { storage } from "../lib/storage";
import { StorageError } from "../lib/storage";

export const publicRoutes = new Hono();

// 公开直链：/public/:username/:slug —— attachment 直接下载
publicRoutes.get("/:username/:slug", async (c) => {
  const { username, slug } = c.req.param();
  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.username, username),
  });
  if (!user) return c.notFound();
  const file = await db.query.files.findFirst({
    where: and(eq(files.ownerId, user.id), eq(files.slug, slug)),
  });
  if (!file || !file.isPublic) return c.notFound();

  let data: Uint8Array<ArrayBuffer>;
  try {
    data = await storage.readFile({ fileKey: file.key });
  } catch (e) {
    if (e instanceof StorageError && e.code === "STORAGE_OBJECT_NOT_FOUND") {
      return c.notFound();
    }
    // 平台策略禁止公开分发该类型（如 APK 安装包）等情况：返回明确提示而不是 500
    return c.text("该文件类型不允许公开分发（平台策略限制）", 403);
  }

  const disposition = `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`;
  return c.body(data, 200, {
    "Content-Type": file.contentType || "application/octet-stream",
    "Content-Disposition": disposition,
    "Cache-Control": "public, max-age=300",
  });
});
