import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const migrationUrl = process.env.DATABASE_MIGRATION_URL;

export default defineConfig({
  out: "./drizzle",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  strict: true,
  verbose: true,
  ...(migrationUrl
    ? {
        dbCredentials: {
          url: migrationUrl,
        },
      }
    : {}),
});
