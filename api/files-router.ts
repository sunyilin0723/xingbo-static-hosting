import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { userProcedure } from "./procedures";
import { getTokenFromRequest, verifyToken } from "./lib/auth";
import { users } from "../db/schema";
import { storage } from "./lib/storage";
import { getDb } from "./queries/connection";
import { files } from "../db/schema";

export const MAX_FILES = 20;
export const MAX_BYTES = 20 * 1024 * 1024;

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
      .slice(0, 60) || "file";
  return base;
}

async function uniqueSlug(ownerId: number, base: string): Promise<string> {
  const db = getDb();
  let slug = base;
  for (let i = 2; ; i++) {
    const existing = await db.query.files.findFirst({
      where: and(eq(files.ownerId, ownerId), eq(files.slug, slug)),
    });
    if (!existing) return slug;
    slug = `${base}-${i}`;
  }
}

export const filesRouter = createRouter({
  me: publicQuery.query(async ({ ctx }) => {
    const token = getTokenFromRequest(ctx.req);
    const payload = token && verifyToken(token);
    if (!payload) return null;
    const user = await getDb().query.users.findFirst({
      where: eq(users.id, payload.uid),
    });
    if (!user) return null;
    return { id: user.id, username: user.username };
  }),

  list: userProcedure.query(async ({ ctx }) => {
    const rows = await getDb().query.files.findMany({
      where: eq(files.ownerId, ctx.user.id),
      orderBy: (f, { desc }) => [desc(f.createdAt)],
    });
    return rows;
  }),

  upload: userProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        contentBase64: z.string(),
        contentType: z.string().max(128).optional(),
        isPublic: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const bytes = Buffer.from(input.contentBase64, "base64");
      if (bytes.byteLength === 0)
        throw new TRPCError({ code: "BAD_REQUEST", message: "文件为空" });
      if (bytes.byteLength > MAX_BYTES)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "文件超过 20MB 限制",
        });
      const db = getDb();
      const count = await db.query.files.findMany({
        where: eq(files.ownerId, ctx.user.id),
      });
      if (count.length >= MAX_FILES)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `每人最多 ${MAX_FILES} 个文件，请先删除一些`,
        });

      const slug = await uniqueSlug(ctx.user.id, makeSlug(input.name));
      let saved;
      try {
        saved = await storage.uploadFile({
          fileContent: new Uint8Array(bytes),
          fileName: `u/${ctx.user.id}/${slug}`,
          contentType: input.contentType,
        });
      } catch (e: any) {
        const msg: string = e?.message ?? "";
        if (/audit|moderation|审核/i.test(msg) || e?.code === "STORAGE_REVIEW_REJECTED")
          throw new TRPCError({ code: "BAD_REQUEST", message: "文件未通过平台内容审核，无法上传" });
        if (e?.code === "STORAGE_RATE_LIMITED")
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "上传太频繁，请稍后再试" });
        if (e?.code === "STORAGE_QUOTA_EXCEEDED")
          throw new TRPCError({ code: "BAD_REQUEST", message: "存储配额已满，请清理文件或图片" });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "存储服务暂时不可用，请稍后重试" });
      }
      await db.insert(files).values({
        ownerId: ctx.user.id,
        name: input.name.slice(0, 255),
        slug,
        key: saved.key,
        size: saved.size,
        contentType: input.contentType || saved.contentType || "application/octet-stream",
        isPublic: input.isPublic ?? true,
      });
      return { slug, size: saved.size };
    }),

  update: userProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        slug: slugSchema.optional(),
        name: z.string().min(1).max(255).optional(),
        isPublic: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const row = await db.query.files.findFirst({
        where: and(eq(files.id, input.id), eq(files.ownerId, ctx.user.id)),
      });
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      if (input.slug && input.slug !== row.slug) {
        const taken = await db.query.files.findFirst({
          where: and(eq(files.ownerId, ctx.user.id), eq(files.slug, input.slug)),
        });
        if (taken)
          throw new TRPCError({ code: "CONFLICT", message: "链接名已被占用" });
      }
      await db
        .update(files)
        .set({
          ...(input.slug ? { slug: input.slug } : {}),
          ...(input.name ? { name: input.name } : {}),
          ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
          updatedAt: new Date(),
        })
        .where(eq(files.id, row.id));
      return { ok: true };
    }),

  remove: userProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const row = await db.query.files.findFirst({
        where: and(eq(files.id, input.id), eq(files.ownerId, ctx.user.id)),
      });
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      await db.delete(files).where(eq(files.id, row.id));
      await storage.deleteFile({ fileKey: row.key });
      return { ok: true };
    }),
});
