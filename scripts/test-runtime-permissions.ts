import { config } from "dotenv";
import postgres from "postgres";
import { z } from "zod";
import { resolveRuntimeDatabaseUrl } from "../lib/database/runtime-url";

config({ path: ".env.local", quiet: true });

const environmentSchema = z.object({
  APP_ENV: z.enum(["development", "test", "staging", "production"]),
  DATABASE_URL: z.string().min(1),
  DATABASE_MIGRATION_URL: z.string().min(1),
  APP_RUNTIME_DATABASE_PASSWORD: z.string().min(16),
});

async function main() {
  const env = environmentSchema.parse(process.env);
  const runtimeUrl = resolveRuntimeDatabaseUrl({
    appEnvironment: env.APP_ENV,
    databaseUrl: env.DATABASE_URL,
    migrationUrl: env.DATABASE_MIGRATION_URL,
    runtimePassword: env.APP_RUNTIME_DATABASE_PASSWORD,
  });
  const database = postgres(runtimeUrl, {
    connect_timeout: 10,
    max: 1,
    prepare: false,
    ssl: "require",
  });
  try {
    const [identity] = await database<
      { current_user: string; rolbypassrls: boolean }[]
    >`
      SELECT current_user, rolbypassrls
      FROM pg_roles
      WHERE rolname = current_user
    `;
    const runtimeIdentity =
      identity.current_user === "app_runtime" ||
      identity.current_user.startsWith("app_runtime.");
    await database`SELECT id FROM app.plans LIMIT 1`;

    let cannotReadAuth = false;
    try {
      await database`SELECT id FROM auth.users WHERE false`;
    } catch {
      cannotReadAuth = true;
    }

    let cannotDeleteAudit = false;
    try {
      await database`DELETE FROM app.audit_logs WHERE false`;
    } catch {
      cannotDeleteAudit = true;
    }

    const checks = {
      runtimeIdentity,
      cannotBypassRls: identity.rolbypassrls === false,
      canReadExplicitAppTables: true,
      cannotReadSupabaseAuth: cannotReadAuth,
      cannotDeleteAuditLogs: cannotDeleteAudit,
    };
    process.stdout.write(`${JSON.stringify({ checks }, null, 2)}\n`);
    if (Object.values(checks).some((passed) => !passed)) process.exitCode = 1;
  } finally {
    await database.end({ timeout: 5 });
  }
}

main().catch(() => {
  process.stderr.write(
    "Runtime permission test failed. Check the restricted DATABASE_URL.\n",
  );
  process.exitCode = 1;
});
