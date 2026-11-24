import { defineConfig } from "drizzle-kit";

// Workers 分支：D1 (SQLite)。建表不依赖本配置 —— 直接使用 db/schema.sql：
//   npx wrangler d1 execute xingbo-static-hosting --file=db/schema.sql
// 本配置仅用于需要 drizzle-kit 生成新迁移时（driver: d1-http）。
export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
    databaseId: process.env.D1_DATABASE_ID ?? "",
    token: process.env.CLOUDFLARE_API_TOKEN ?? "",
  },
});
