import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { env } from "../lib/env";
import * as schema from "../../db/schema";

let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb() {
  if (!_db) {
    const client = mysql.createPool(env.databaseUrl);
    _db = drizzle(client, { schema, mode: "default" });
  }
  return _db;
}
