import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

export default defineConfig({
  dialect: "mysql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dbCredentials: {
    url: connectionString,
  },
});
