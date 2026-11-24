import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { createRouter } from "./middleware";
import { userProcedure } from "./procedures";
import { storage } from "./lib/storage";
import { detectImage } from "./lib/magic";
import { getDb } from "./queries/connection";
import { images } from "../db/schema";

export const IMAGE_SMALL_MAX = 200 * 1024; // 200KB 及以下不限量
export const IMAGE_HARD_MAX = 20 * 1024 * 1024; // 单图硬上限 20MB
export const IMAGE_QUOTA_BYTES = 50 * 1024 * 1024; // 高级空间（>200KB 图片）总量 50MB

const slugSchema = z
  .string()
  .regex(/^[a-zA-Z0-9._-]{1,200}$/, "链接名只能包含字母、数字、._-");

function makeSlug(name: string): string {
  const base =
    name
      .toLowerCase()
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "img";
  return base;
}

async function uniqueImageSlug(ownerId: number, base: string): Promise<string> {
  const db = getDb();
  let slug = base;
  for (let i = 2; ; i++) {
    const existing = await db.query.images.findFirst({
      where: and(eq(images.ownerId, ownerId), eq(images.slug, slug)),
    });
    if (!existing) return slug;
    slug = `${base}-${i}`;
  }
}

export const imagesRouter = createRouter({
  list: userProcedure.query(async ({ ctx }) => {
    const rows = await getDb().query.images.findMany({
      where: eq(images.ownerId, ctx.user.id),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
    return rows;
  }),

  upload: userProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        contentBase64: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const bytes = Buffer.from(input.contentBase64, "base64");
      if (bytes.byteLength < 12)
        throw new TRPCError({ code: "BAD_REQUEST", message: "文件太小或为空" });
      if (bytes.byteLength > IMAGE_HARD_MAX)
        throw new TRPCError({ code: "BAD_REQUEST", message: "单张图片最大 20MB" });

      // 魔数检测：确认真实图片格式，伪装成图片的文件直接拒绝
      const detected = detectImage(new Uint8Array(bytes));
      if (!detected)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "未通过图片校验：文件头不是已知图片格式（仅支持 JPG/PNG/GIF/WebP/BMP/AVIF/HEIC）",
        });

      const usesQuota = bytes.byteLength > IMAGE_SMALL_MAX;
      const db = getDb();

      if (usesQuota) {
        // 大图占用高级空间：总量 50MB
        const bigImages = await db.query.images.findMany({
          where: and(eq(images.ownerId, ctx.user.id), eq(images.usesQuota, true)),
        });
        const used = bigImages.reduce((sum, r) => sum + r.size, 0);
        if (used + bytes.byteLength > IMAGE_QUOTA_BYTES)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `高级空间（>200KB 图片）共 50MB，已用 ${(used / 1024 / 1024).toFixed(1)}MB，空间不足，请删除大图后再传`,
          });
      }

const slug = await uniqueImageSlug(ctx.user.id, makeSlug(input.name));
      let saved;
      try {
        saved = await storage.uploadFile({
          fileContent: new Uint8Array(bytes),
          fileName: `img/${ctx.user.id}/${slug}.${detected.ext}`,
          contentType: detected.contentType,
        });
      } catch (e: any) {
        const msg: string = e?.message ?? "";
        if (/audit|moderation|审核/i.test(msg) || e?.code === "STORAGE_REVIEW_REJECTED")
          throw new TRPCError({ code: "BAD_REQUEST", message: "图片未通过平台内容审核，无法上传" });
        if (e?.code === "STORAGE_RATE_LIMITED")
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "上传太频繁，请稍后再试" });
        if (e?.code === "STORAGE_QUOTA_EXCEEDED")
          throw new TRPCError({ code: "BAD_REQUEST", message: "存储配额已满，请清理文件或图片" });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "存储服务暂时不可用，请稍后重试" });
      }
      await db.insert(images).values({
        ownerId: ctx.user.id,
        name: input.name.slice(0, 255),
        slug,
        key: saved.key,
        size: saved.size,
        contentType: detected.contentType,
        usesQuota,
      });
      return { slug, size: saved.size, contentType: detected.contentType, usesQuota };
    }),

  update: userProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        slug: slugSchema.optional(),
        name: z.string().min(1).max(255).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const row = await db.query.images.findFirst({
        where: and(eq(images.id, input.id), eq(images.ownerId, ctx.user.id)),
      });
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      if (input.slug && input.slug !== row.slug) {
        const taken = await db.query.images.findFirst({
          where: and(eq(images.ownerId, ctx.user.id), eq(images.slug, input.slug)),
        });
        if (taken)
          throw new TRPCError({ code: "CONFLICT", message: "链接名已被占用" });
      }
      await db
        .update(images)
        .set({
          ...(input.slug ? { slug: input.slug } : {}),
          ...(input.name ? { name: input.name } : {}),
        })
        .where(eq(images.id, row.id));
      return { ok: true };
    }),

  remove: userProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const row = await db.query.images.findFirst({
        where: and(eq(images.id, input.id), eq(images.ownerId, ctx.user.id)),
      });
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      await db.delete(images).where(eq(images.id, row.id));
      await storage.deleteFile({ fileKey: row.key });
      return { ok: true };
    }),
});
