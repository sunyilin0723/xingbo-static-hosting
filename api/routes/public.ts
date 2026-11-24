import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { users, files } from "../../db/schema";
import { storage } from "../lib/storage";

export const publicRoutes = new Hono();

publicRoutes.get("/:username/:slug", async (c) => {
  const { username, slug } = c.req.param();
  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.username, username),
  });
  if (!user) return c.body(null, 404);
  const file = await db.query.files.findFirst({
    where: and(eq(files.ownerId, user.id), eq(files.slug, slug)),
  });
  if (!file || !file.isPublic) return c.body(null, 404);

  let data: Uint8Array<ArrayBuffer>;
  try {
    data = new Uint8Array(await storage.readFile({ fileKey: file.key }));
  } catch (e: any) {
    const code: string = e?.code ?? "";
    if (code === "STORAGE_OBJECT_NOT_FOUND") return c.body(null, 404);
    // 平台存储策略禁止公开发布的格式（如 APK 等）会在这里被拒绝
    return c.json(
      {
        error: "该文件类型不允许公开分发（平台存储策略限制）",
        code: code || "STORAGE_ERROR",
      },
      403,
    );
  }
  return c.body(data, 200, {
    "Content-Type": file.contentType,
    "Content-Length": String(data.byteLength),
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    "Cache-Control": "public, max-age=60",
    "X-Content-Type-Options": "nosniff",
  });
});
