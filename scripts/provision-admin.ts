import { config } from "dotenv";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createSecretKeyFetch } from "../lib/supabase/secret-fetch";

config({ path: ".env.local", quiet: true });

const environmentSchema = z.object({
  ADMIN_EMAIL: z.email(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  DATABASE_MIGRATION_URL: z.string().min(1),
});

const passwordSchema = z.string().min(6).max(128);
let currentStage = "environment";

async function readPassword() {
  if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    return new Promise<string>((resolve, reject) => {
      let value = "";
      const finish = () => {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        try {
          resolve(passwordSchema.parse(value));
        } catch (error) {
          reject(error);
        }
      };
      process.stdin.on("data", (chunk: Buffer | string) => {
        for (const character of Buffer.from(chunk).toString("utf8")) {
          if (character === "\r" || character === "\n") {
            finish();
            return;
          }
          if (character === "\u0003") {
            process.stdin.setRawMode(false);
            reject(new Error("password_input_cancelled"));
            return;
          }
          if (character === "\b" || character === "\u007f") {
            value = value.slice(0, -1);
          } else {
            value += character;
          }
        }
      });
    });
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return passwordSchema.parse(Buffer.concat(chunks).toString("utf8").trim());
}

async function main() {
  const env = environmentSchema.parse(process.env);
  currentStage = "password_input";
  const password = await readPassword();
  const admin = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SECRET_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        fetch: createSecretKeyFetch(env.SUPABASE_SECRET_KEY),
      },
    },
  );
  const database = postgres(env.DATABASE_MIGRATION_URL, {
    connect_timeout: 10,
    max: 1,
    onnotice: () => undefined,
    prepare: false,
    ssl: "require",
  });
  let createdAuthUser = false;
  let authUserId: string | undefined;

  try {
    currentStage = "existing_identity";
    const [existingAuthUser] = await database<{ id: string }[]>`
      SELECT id
      FROM auth.users
      WHERE lower(email) = lower(${env.ADMIN_EMAIL})
      LIMIT 1
    `;

    currentStage = "auth_identity";
    if (existingAuthUser) {
      authUserId = existingAuthUser.id;
      const update = await admin.auth.admin.updateUserById(authUserId, {
        password,
        email_confirm: true,
        user_metadata: {
          display_name: "Administrator",
          username: "administrator",
          requested_role: "admin",
        },
      });
      if (update.error) throw update.error;
    } else {
      const creation = await admin.auth.admin.createUser({
        email: env.ADMIN_EMAIL,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: "Administrator",
          username: "administrator",
          requested_role: "admin",
        },
      });
      if (creation.error || !creation.data.user) {
        throw creation.error ?? new Error("auth_user_missing");
      }
      authUserId = creation.data.user.id;
      createdAuthUser = true;
    }

    currentStage = "application_identity";
    const resolvedAuthUserId = authUserId;
    await database.begin(async (transaction) => {
      const [existingAppUser] = await transaction<{ id: string }[]>`
        SELECT id
        FROM app.users
        WHERE auth_user_id = ${resolvedAuthUserId}
        LIMIT 1
      `;
      let appUserId = existingAppUser?.id;
      if (!appUserId) {
        const [usernameConflict] = await transaction<{ exists: boolean }[]>`
          SELECT true AS exists
          FROM app.users
          WHERE normalized_username = 'administrator'
          LIMIT 1
        `;
        const username = usernameConflict
          ? `admin_${resolvedAuthUserId.slice(0, 8)}`
          : "administrator";
        const [createdAppUser] = await transaction<{ id: string }[]>`
          INSERT INTO app.users (
            auth_user_id,
            username,
            normalized_username,
            display_name,
            status
          )
          VALUES (
            ${resolvedAuthUserId},
            ${username},
            ${username},
            'Administrator',
            'active'
          )
          RETURNING id
        `;
        appUserId = createdAppUser.id;
      } else {
        await transaction`
          UPDATE app.users
          SET status = 'active', updated_at = now()
          WHERE id = ${appUserId}
        `;
      }

      await transaction`
        DELETE FROM app.user_roles
        WHERE user_id = ${appUserId}
          AND role <> 'admin'
      `;
      await transaction`
        INSERT INTO app.user_roles (user_id, role)
        VALUES (${appUserId}, 'admin')
        ON CONFLICT DO NOTHING
      `;
      await transaction`
        INSERT INTO app.audit_logs (
          actor_user_id,
          action,
          target_type,
          target_id,
          reason
        )
        VALUES (
          ${appUserId},
          'admin.provisioned',
          'user',
          ${appUserId},
          'Direct administrator provisioning outside public registration'
        )
      `;
    });

    process.stdout.write(
      "Administrator provisioned. Sign in with ADMIN_EMAIL and complete MFA.\n",
    );
  } catch (error) {
    if (createdAuthUser && authUserId) {
      await admin.auth.admin.deleteUser(authUserId).catch(() => undefined);
    }
    throw error;
  } finally {
    await database.end({ timeout: 5 });
  }
}

main().catch(() => {
  process.stderr.write(
    `Administrator provisioning failed safely during ${currentStage}. No email, password, token, or credential was logged.\n`,
  );
  process.exitCode = 1;
});
