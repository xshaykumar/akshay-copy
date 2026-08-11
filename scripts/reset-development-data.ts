import { config } from "dotenv";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createSecretKeyFetch } from "../lib/supabase/secret-fetch";

config({ path: ".env.local", quiet: true });

const environmentSchema = z.object({
  APP_ENV: z.literal("development"),
  PAYMENTS_MODE: z.literal("mock"),
  RESET_DEVELOPMENT_DATA: z.literal("YES"),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  DATABASE_MIGRATION_URL: z.string().min(1),
});

type StorageEntry = {
  name: string;
  id: string | null;
};

let currentStage = "environment";

async function listObjectPaths(
  admin: SupabaseClient,
  bucket: string,
  prefix = "",
): Promise<string[]> {
  const { data, error } = await admin.storage
    .from(bucket)
    .list(prefix, { limit: 1000 });
  if (error) throw error;
  const paths: string[] = [];
  for (const entry of (data ?? []) as StorageEntry[]) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id) {
      paths.push(path);
    } else {
      paths.push(...(await listObjectPaths(admin, bucket, path)));
    }
  }
  return paths;
}

async function main() {
  const env = environmentSchema.parse(process.env);
  const admin = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SECRET_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: createSecretKeyFetch(env.SUPABASE_SECRET_KEY) },
    },
  );
  const database = postgres(env.DATABASE_MIGRATION_URL, {
    connect_timeout: 10,
    max: 1,
    onnotice: () => undefined,
    prepare: false,
    ssl: "require",
  });

  let removedFiles = 0;
  let removedAuthUsers = 0;
  let clearedTables = 0;
  try {
    currentStage = "private_storage";
    for (const bucket of ["assessment-reports", "chat-attachments", "profile-photos", "coach-certificates"]) {
      const [stored] = await database<{ value: number }[]>`
        SELECT count(*)::int AS value
        FROM storage.objects
        WHERE bucket_id = ${bucket}
      `;
      if ((stored?.value ?? 0) === 0) continue;
      const paths = await listObjectPaths(admin, bucket);
      for (let index = 0; index < paths.length; index += 100) {
        const batch = paths.slice(index, index + 100);
        const { error } = await admin.storage.from(bucket).remove(batch);
        if (error) throw error;
        removedFiles += batch.length;
      }
    }

    currentStage = "application_tables";
    const tables = await database<{ tablename: string }[]>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'app'
      ORDER BY tablename
    `;
    if (tables.length > 0) {
      const targets = tables
        .map(
          ({ tablename }) =>
            `app."${tablename.replaceAll('"', '""')}"`,
        )
        .join(", ");
      await database.unsafe(`TRUNCATE TABLE ${targets} CASCADE`);
      clearedTables = tables.length;
    }

    currentStage = "auth_users_database";
    const deleted = await database<{ id: string }[]>`
      DELETE FROM auth.users
      RETURNING id
    `;
    removedAuthUsers = deleted.length;

    process.stdout.write(
      `Development reset complete: ${clearedTables} app tables cleared, ${removedAuthUsers} auth users removed, ${removedFiles} private files removed.\n`,
    );
  } finally {
    await database.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  const safeCode =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code.replace(/[^a-z0-9_-]/gi, "")
      :
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    (typeof error.statusCode === "string" ||
      typeof error.statusCode === "number")
      ? String(error.statusCode).replace(/[^a-z0-9_-]/gi, "")
      : error instanceof Error
        ? error.name.replace(/[^a-z0-9_-]/gi, "")
        : "unknown";
  process.stderr.write(
    `Development reset failed safely during ${currentStage} (${safeCode}). No credentials or record contents were logged.\n`,
  );
  process.exitCode = 1;
});
