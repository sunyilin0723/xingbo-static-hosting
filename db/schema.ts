import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Cloudflare D1 (SQLite) schema for the Workers deployment.
// TS property names are kept IDENTICAL to the MySQL version so that every
// router/query file works unchanged. Column names in the DB are also identical.

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username", { length: 32 }).notNull().unique(),
  passwordHash: text("password_hash", { length: 255 }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const files = sqliteTable("files", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: integer("owner_id").notNull().references(() => users.id),
  name: text("name", { length: 255 }).notNull(),
  slug: text("slug", { length: 255 }).notNull(),
  key: text("key", { length: 512 }).notNull(),
  size: integer("size").notNull(),
  contentType: text("content_type", { length: 128 })
    .notNull()
    .default("application/octet-stream"),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const images = sqliteTable("images", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: integer("owner_id").notNull().references(() => users.id),
  name: text("name", { length: 255 }).notNull(),
  slug: text("slug", { length: 255 }).notNull(),
  key: text("key", { length: 512 }).notNull(),
  size: integer("size").notNull(),
  contentType: text("content_type", { length: 128 }).notNull(),
  usesQuota: integer("uses_quota", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});
