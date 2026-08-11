import { config } from "dotenv";
import postgres from "postgres";
import { z, ZodError } from "zod";

config({ path: ".env.local", quiet: true });

const setupEnvironmentSchema = z.object({
  DATABASE_MIGRATION_URL: z.string().min(1),
  APP_RUNTIME_DATABASE_PASSWORD: z.string().min(16),
});

function quotePostgresLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

async function main() {
  const env = setupEnvironmentSchema.parse({
    DATABASE_MIGRATION_URL: process.env.DATABASE_MIGRATION_URL,
    APP_RUNTIME_DATABASE_PASSWORD:
      process.env.APP_RUNTIME_DATABASE_PASSWORD,
  });

  const migrationClient = postgres(env.DATABASE_MIGRATION_URL, {
    connect_timeout: 10,
    max: 1,
    prepare: false,
    ssl: "require",
  });

  try {
    const password = quotePostgresLiteral(
      env.APP_RUNTIME_DATABASE_PASSWORD,
    );
    await migrationClient.unsafe(
      `ALTER ROLE app_runtime WITH LOGIN PASSWORD ${password}`,
    );
    process.stdout.write(
      "Configured the restricted app_runtime database role.\n",
    );
  } finally {
    await migrationClient.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  if (error instanceof ZodError) {
    process.stderr.write(
      "APP_RUNTIME_DATABASE_PASSWORD must contain at least 16 characters.\n",
    );
    process.exitCode = 1;
    return;
  }
  const safeType =
    error instanceof Error ? error.constructor.name : typeof error;
  const safeCode =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "unknown";
  process.stderr.write(
    `Failed to configure app_runtime (type: ${safeType}; PostgreSQL code: ${safeCode}). Verify the migration was applied and the development database credentials are correct.\n`,
  );
  process.exitCode = 1;
});
