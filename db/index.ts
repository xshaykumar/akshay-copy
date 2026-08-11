import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getServerEnv } from "@/lib/env/server";
import { resolveRuntimeDatabaseUrl } from "@/lib/database/runtime-url";
import * as schema from "./schema";

let client: ReturnType<typeof postgres> | undefined;

export function getDb() {
  if (!client) {
    const env = getServerEnv();
    const runtimeUrl = resolveRuntimeDatabaseUrl({
      appEnvironment: env.APP_ENV,
      databaseUrl: env.DATABASE_URL,
      migrationUrl: env.DATABASE_MIGRATION_URL,
      runtimePassword: env.APP_RUNTIME_DATABASE_PASSWORD,
    });
    client = postgres(runtimeUrl, {
      connect_timeout: 10,
      idle_timeout: 20,
      max: 5,
      prepare: false,
      ssl: "require",
    });
  }

  return drizzle(client, { schema });
}
