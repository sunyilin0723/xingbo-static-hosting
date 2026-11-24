import {
  mysqlTable,
  serial,
  varchar,
  bigint,
  boolean,
  timestamp,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 32 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const files = mysqlTable("files", {
  id: serial("id").primaryKey(),
  ownerId: bigint("owner_id", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  key: varchar("key", { length: 512 }).notNull(),
  size: bigint("size", { mode: "number", unsigned: true }).notNull(),
  contentType: varchar("content_type", { length: 128 }).notNull().default("application/octet-stream"),
  isPublic: boolean("is_public").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const images = mysqlTable("images", {
  id: serial("id").primaryKey(),
  ownerId: bigint("owner_id", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  key: varchar("key", { length: 512 }).notNull(),
  size: bigint("size", { mode: "number", unsigned: true }).notNull(),
  contentType: varchar("content_type", { length: 128 }).notNull(),
  usesQuota: boolean("uses_quota").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
