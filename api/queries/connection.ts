import { drizzle } from "drizzle-orm/d1";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

let instance: ReturnType<typeof drizzle<typeof fullSchema>> | undefined;

// D1 binding is stashed on globalThis by the Worker entry (api/worker-entry.ts)
// because bindings only arrive on the fetch handler's env, not as globals.
export function getDb() {
  if (!instance) {
    const d1 = (globalThis as any).__D1;
    if (!d1) throw new Error("D1 database binding (DB) is not available");
    instance = drizzle(d1, { schema: fullSchema });
  }
  return instance;
}
