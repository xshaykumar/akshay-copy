import { config } from "dotenv";
import postgres from "postgres";
import { z } from "zod";

config({ path: ".env.local", quiet: true });

const environmentSchema = z.object({
  DATABASE_MIGRATION_URL: z.string().min(1),
});

async function main() {
  const env = environmentSchema.parse(process.env);
  const database = postgres(env.DATABASE_MIGRATION_URL, {
    connect_timeout: 10,
    max: 1,
    prepare: false,
    ssl: "require",
  });

  try {
    const [tables] = await database<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'app' AND c.relkind = 'r'
    `;
    const [secured] = await database<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'app'
        AND c.relkind = 'r'
        AND c.relrowsecurity
        AND c.relforcerowsecurity
    `;
    const [exposed] = await database<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM information_schema.table_privileges
      WHERE table_schema = 'app'
        AND grantee IN ('PUBLIC', 'anon', 'authenticated')
    `;
    const [publicBuckets] = await database<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM storage.buckets
      WHERE id IN ('assessment-reports', 'chat-attachments', 'profile-photos', 'coach-certificates')
        AND public = true
    `;
    const [runtimeRole] = await database<
      { rolcanlogin: boolean; rolbypassrls: boolean }[]
    >`
      SELECT rolcanlogin, rolbypassrls
      FROM pg_roles
      WHERE rolname = 'app_runtime'
    `;

    const checks = {
      allAppTablesForceRls: tables.count === secured.count,
      noBrowserTableGrants: exposed.count === 0,
      storageBucketsPrivate: publicBuckets.count === 0,
      runtimeCanLogin: runtimeRole?.rolcanlogin === true,
      runtimeCannotBypassRls: runtimeRole?.rolbypassrls === false,
    };
    const failed = Object.entries(checks)
      .filter(([, passed]) => !passed)
      .map(([name]) => name);
    process.stdout.write(
      `${JSON.stringify({ tables: tables.count, checks }, null, 2)}\n`,
    );
    if (failed.length > 0) process.exitCode = 1;
  } finally {
    await database.end({ timeout: 5 });
  }
}

main().catch(() => {
  process.stderr.write("Database security verification failed safely.\n");
  process.exitCode = 1;
});
