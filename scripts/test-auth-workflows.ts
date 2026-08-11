import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { config } from "dotenv";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createSecretKeyFetch } from "../lib/supabase/secret-fetch";

config({ path: ".env.local", quiet: true });

const environmentSchema = z.object({
  APP_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  DATABASE_MIGRATION_URL: z.string().min(1),
});

class CookieJar {
  private values = new Map<string, string>();

  absorb(response: Response) {
    const values = (
      response.headers as Headers & { getSetCookie?: () => string[] }
    ).getSetCookie?.() ?? [];
    for (const raw of values) {
      const [pair] = raw.split(";", 1);
      const separator = pair.indexOf("=");
      if (separator < 1) continue;
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      if (/max-age=0/i.test(raw)) this.values.delete(name);
      else this.values.set(name, value);
    }
  }

  header() {
    return [...this.values.entries()]
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }
}

type ApiError = { error?: { code?: string } };
let currentStage = "initialization";

async function api<T>(
  appUrl: string,
  path: string,
  options: {
    method?: string;
    body?: unknown;
    formData?: FormData;
    jar?: CookieJar;
    expected?: number[];
    idempotent?: boolean;
  } = {},
) {
  const headers = new Headers({ Origin: appUrl });
  const cookie = options.jar?.header();
  if (cookie) headers.set("Cookie", cookie);
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.idempotent) headers.set("Idempotency-Key", randomUUID());
  const response = await fetch(`${appUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.formData ??
      (options.body === undefined ? undefined : JSON.stringify(options.body)),
  });
  options.jar?.absorb(response);
  const result = (await response.json().catch(() => ({}))) as T & ApiError;
  if (!(options.expected ?? [200]).includes(response.status)) {
    const code = result.error?.code?.replace(/[^a-z0-9_-]/gi, "") ?? "unknown";
    throw new Error(`http_${response.status}_${code}`);
  }
  return result;
}

function decodeBase32(value: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const character of value.toUpperCase().replace(/=+$/g, "")) {
    const index = alphabet.indexOf(character);
    if (index >= 0) bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function totp(secret: string) {
  const counter = Math.floor(Date.now() / 30_000);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    (((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff)) %
    1_000_000;
  return String(code).padStart(6, "0");
}

async function removeAuthChecks(
  database: postgres.Sql,
  deleteAuthUser: (id: string) => Promise<{ error: Error | null }>,
  emails?: string[],
) {
  const authRows = emails
    ? await database<{ id: string }[]>`
        SELECT id
        FROM auth.users
        WHERE lower(email) = ANY(${emails})
      `
    : await database<{ id: string }[]>`
        SELECT id
        FROM auth.users
        WHERE lower(email) LIKE 'codex-client-%@example.com'
           OR lower(email) LIKE 'codex-coach-%@example.com'
           OR lower(email) LIKE 'codex-admin-%@example.com'
      `;
  for (const { id } of authRows) {
    await database`DELETE FROM app.users WHERE auth_user_id = ${id}`;
    const deletion = await deleteAuthUser(id);
    if (deletion.error) throw deletion.error;
  }
}

async function main() {
  const env = environmentSchema.parse({
    ...process.env,
    APP_URL: process.env.APP_URL ?? "http://localhost:3000",
  });
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const credentials = {
    client: {
      email: `codex-client-${suffix}@example.com`,
      password: `${randomBytes(24).toString("base64url")}Aa1!`,
      username: `client_${suffix}`,
    },
    coach: {
      email: `codex-coach-${suffix}@example.com`,
      password: `${randomBytes(24).toString("base64url")}Aa1!`,
      username: `coach_${suffix}`,
    },
    admin: {
      email: `codex-admin-${suffix}@example.com`,
      password: `${randomBytes(24).toString("base64url")}Aa1!`,
      username: `admin_${suffix}`,
    },
  };
  const database = postgres(env.DATABASE_MIGRATION_URL, {
    connect_timeout: 10,
    max: 1,
    onnotice: () => undefined,
    prepare: false,
    ssl: "require",
  });
  const admin = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SECRET_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: createSecretKeyFetch(env.SUPABASE_SECRET_KEY) },
    },
  );
  const sessions: Partial<Record<"client" | "coach", CookieJar>> = {};
  const userIds: Partial<Record<"client" | "coach", string>> = {};

  try {
    currentStage = "stale_test_cleanup";
    await removeAuthChecks(database, (id) => admin.auth.admin.deleteUser(id));

    currentStage = "health_check";
    const health = await fetch(env.APP_URL);
    if (!health.ok) throw new Error(`app_unavailable_${health.status}`);

    for (const role of ["client", "coach"] as const) {
      const account = credentials[role];
      currentStage = `${role}_registration`;
      const registrationJar = new CookieJar();
      const registered = await api<{
        destination?: string;
        requiresEmailConfirmation?: boolean;
      }>(env.APP_URL, "/api/auth/register", {
        method: "POST",
        jar: registrationJar,
        expected: [201],
        body: {
          displayName: `${role === "client" ? "Client" : "Coach"} Auth Check`,
          username: account.username,
          email: account.email,
          password: account.password,
          role,
          acceptedTerms: true,
          ...(role === "client"
            ? {
                state: "Delhi",
                city: "New Delhi",
                district: "South Delhi",
              }
            : {}),
        },
      });
      if (registered.requiresEmailConfirmation) {
        throw new Error("confirm_email_is_still_enabled");
      }
      if (registered.destination !== `/${role}`) {
        throw new Error(`${role}_registration_destination`);
      }

      currentStage = `${role}_registered_session`;
      const registeredMe = await api<{
        user?: { id?: string; roles?: string[] };
      }>(env.APP_URL, "/api/me", { jar: registrationJar });
      if (
        !registeredMe.user?.id ||
        !registeredMe.user.roles?.includes(role)
      ) {
        throw new Error(`${role}_registered_identity`);
      }
      userIds[role] = registeredMe.user.id;

      currentStage = `${role}_fresh_signin`;
      const loginJar = new CookieJar();
      const login = await api<{ destination?: string }>(
        env.APP_URL,
        "/api/auth/login",
        {
          method: "POST",
          jar: loginJar,
          body: { email: account.email, password: account.password },
        },
      );
      if (login.destination !== `/${role}`) {
        throw new Error(`${role}_login_destination`);
      }
      const signedInMe = await api<{ user?: { roles?: string[] } }>(
        env.APP_URL,
        "/api/me",
        { jar: loginJar },
      );
      if (!signedInMe.user?.roles?.includes(role)) {
        throw new Error(`${role}_login_identity`);
      }
      sessions[role] = loginJar;

      currentStage = `${role}_permission_boundary`;
      await api(
        env.APP_URL,
        role === "client" ? "/api/coach/profile" : "/api/assessments",
        { jar: loginJar, expected: [403] },
      );

      if (role === "coach") {
        currentStage = "coach_profile_save";
        await api(env.APP_URL, "/api/coach/profile", {
          method: "PATCH",
          jar: loginJar,
          body: {
            yearsExperience: 5,
            languages: ["English"],
            coachingModes: ["online"],
            locationLabel: null,
            specialties: ["Strength coaching"],
            acceptingClients: false,
          },
        });
        currentStage = "coach_certification_upload";
        const certificate = new FormData();
        certificate.set("qualificationType", "cscs");
        certificate.set(
          "file",
          new File(["%PDF-1.4\n% disposable verification file\n"], "cscs.pdf", {
            type: "application/pdf",
          }),
        );
        await api(env.APP_URL, "/api/coach/certifications", {
          method: "POST",
          jar: loginJar,
          formData: certificate,
          expected: [201],
        });
        currentStage = "coach_certification_submission";
        await api(env.APP_URL, "/api/coach/certifications/submit", {
          method: "POST",
          jar: loginJar,
          idempotent: true,
        });
      }
    }

    currentStage = "database_persistence";
    const rows = await database<
      { email: string; role: string; status: string; approval_status: string | null }[]
    >`
      SELECT
        lower(auth.email) AS email,
        roles.role::text AS role,
        users.status::text AS status,
        coach.approval_status::text AS approval_status
      FROM auth.users AS auth
      INNER JOIN app.users AS users ON users.auth_user_id = auth.id
      INNER JOIN app.user_roles AS roles ON roles.user_id = users.id
      LEFT JOIN app.coach_profiles AS coach ON coach.user_id = users.id
      WHERE lower(auth.email) IN (
        ${credentials.client.email},
        ${credentials.coach.email}
      )
    `;
    const clientRow = rows.find(({ email }) => email === credentials.client.email);
    const coachRow = rows.find(({ email }) => email === credentials.coach.email);
    if (clientRow?.role !== "client" || clientRow.status !== "active") {
      throw new Error("client_database_identity");
    }
    if (
      coachRow?.role !== "coach" ||
      coachRow.status !== "active" ||
      coachRow.approval_status !== "submitted"
    ) {
      throw new Error("coach_database_application");
    }

    currentStage = "unapproved_coach_hidden";
    const directory = await api<{ coaches?: { slug?: string }[] }>(
      env.APP_URL,
      "/api/coaches",
    );
    if (directory.coaches?.some(({ slug }) => slug === credentials.coach.username)) {
      throw new Error("unapproved_coach_exposed");
    }

    currentStage = "disposable_admin_provisioning";
    const adminCreation = await admin.auth.admin.createUser({
      email: credentials.admin.email,
      password: credentials.admin.password,
      email_confirm: true,
      user_metadata: {
        display_name: "Auth Check Administrator",
        username: credentials.admin.username,
        requested_role: "admin",
      },
    });
    if (adminCreation.error || !adminCreation.data.user) {
      throw adminCreation.error ?? new Error("admin_auth_identity_missing");
    }
    await database`
      WITH created AS (
        INSERT INTO app.users (
          auth_user_id,
          username,
          normalized_username,
          display_name,
          status
        )
        VALUES (
          ${adminCreation.data.user.id},
          ${credentials.admin.username},
          ${credentials.admin.username},
          'Auth Check Administrator',
          'active'
        )
        RETURNING id
      )
      INSERT INTO app.user_roles (user_id, role)
      SELECT id, 'admin' FROM created
    `;

    currentStage = "admin_signin_and_mfa";
    const adminJar = new CookieJar();
    const adminLogin = await api<{ destination?: string }>(
      env.APP_URL,
      "/api/auth/login",
      {
        method: "POST",
        jar: adminJar,
        body: {
          email: credentials.admin.email,
          password: credentials.admin.password,
        },
      },
    );
    if (adminLogin.destination !== "/mfa") throw new Error("admin_destination");
    const enrollment = await api<{
      factorId?: string;
      challengeId?: string;
      secret?: string;
    }>(env.APP_URL, "/api/auth/mfa/enroll", {
      method: "POST",
      jar: adminJar,
      body: {},
    });
    if (!enrollment.factorId || !enrollment.secret) {
      throw new Error("admin_mfa_enrollment");
    }
    await api(env.APP_URL, "/api/auth/mfa/verify", {
      method: "POST",
      jar: adminJar,
      body: {
        factorId: enrollment.factorId,
        challengeId: enrollment.challengeId,
        code: totp(enrollment.secret),
      },
    });

    currentStage = "client_admin_boundary";
    await api(env.APP_URL, `/api/admin/coaches/${userIds.coach}/approve`, {
      method: "POST",
      jar: sessions.client,
      idempotent: true,
      body: {},
      expected: [403],
    });

    currentStage = "admin_coach_approval";
    await api(env.APP_URL, `/api/admin/coaches/${userIds.coach}/approve`, {
      method: "POST",
      jar: adminJar,
      idempotent: true,
      body: { message: "Certificates accepted by the automated workflow test." },
    });
    currentStage = "certified_unpaid_coach_hidden";
    const certifiedOnlyDirectory = await api<{
      coaches?: { slug?: string }[];
    }>(env.APP_URL, "/api/coaches");
    if (
      certifiedOnlyDirectory.coaches?.some(
        ({ slug }) => slug === credentials.coach.username,
      )
    ) {
      throw new Error("certified_unpaid_coach_exposed");
    }

    currentStage = "coach_activation_availability";
    await api(env.APP_URL, "/api/coach/activation", {
      method: "PATCH",
      jar: sessions.coach,
      body: {
        availableDays: ["monday", "wednesday", "saturday"],
        availableTimeSlots: ["09:00-10:00", "17:00-18:00"],
        locationState: "Delhi",
        locationCity: "New Delhi",
        locationDistrict: "South Delhi",
      },
    });
    currentStage = "coach_activation_fee";
    await api(env.APP_URL, "/api/coach/activation/pay", {
      method: "POST",
      jar: sessions.coach,
      idempotent: true,
    });
    currentStage = "approved_coach_availability";
    await api(env.APP_URL, "/api/coach/profile", {
      method: "PATCH",
      jar: sessions.coach,
      body: {
        yearsExperience: 5,
        languages: ["English"],
        coachingModes: ["online"],
        locationLabel: null,
        specialties: ["Strength coaching"],
        acceptingClients: true,
      },
    });
    const approvedDirectory = await api<{ coaches?: { slug?: string }[] }>(
      env.APP_URL,
      "/api/coaches",
    );
    if (
      !approvedDirectory.coaches?.some(
        ({ slug }) => slug === credentials.coach.username,
      )
    ) {
      throw new Error("approved_coach_not_visible");
    }

    process.stdout.write(
      "Auth E2E passed: client and coach registration, fresh password sign-in, Supabase/database persistence, role isolation, coach certification review, availability, 30-day activation, and active-only public discovery.\n",
    );
  } finally {
    currentStage = `${currentStage}_cleanup`;
    if (userIds.coach) {
      const bucket = admin.storage.from("coach-certificates");
      const { data } = await bucket.list(userIds.coach, { limit: 100 });
      const paths = (data ?? [])
        .filter((entry) => entry.id)
        .map((entry) => `${userIds.coach}/${entry.name}`);
      if (paths.length > 0) await bucket.remove(paths);
    }
    await removeAuthChecks(
      database,
      (id) => admin.auth.admin.deleteUser(id),
      [
        credentials.client.email,
        credentials.coach.email,
        credentials.admin.email,
      ],
    ).catch(() => undefined);
    await database.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  const safeCode =
    error instanceof Error
      ? error.message.replace(/[^a-z0-9_-]/gi, "").slice(0, 100)
      : "unknown";
  process.stderr.write(
    `Auth E2E failed safely during ${currentStage} (${safeCode}). No email, password, token, or profile content was logged.\n`,
  );
  process.exitCode = 1;
});
