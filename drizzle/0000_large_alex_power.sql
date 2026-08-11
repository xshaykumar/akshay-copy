CREATE SCHEMA "app";
--> statement-breakpoint
CREATE TYPE "app"."account_status" AS ENUM('pending_verification', 'active', 'suspended', 'closed');--> statement-breakpoint
CREATE TYPE "app"."application_role" AS ENUM('client', 'coach', 'admin');--> statement-breakpoint
CREATE TABLE "app"."audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid,
	"request_id" text,
	"reason" text,
	"safe_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."idempotency_keys" (
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_code" text,
	"response_reference" text,
	"locked_until" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_keys_scope_key_pk" PRIMARY KEY("scope","key")
);
--> statement-breakpoint
CREATE TABLE "app"."user_roles" (
	"user_id" uuid NOT NULL,
	"role" "app"."application_role" NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"granted_by_user_id" uuid,
	CONSTRAINT "user_roles_user_id_role_pk" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
CREATE TABLE "app"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"username" text NOT NULL,
	"normalized_username" text NOT NULL,
	"display_name" text NOT NULL,
	"status" "app"."account_status" DEFAULT 'pending_verification' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "app"."audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_roles" ADD CONSTRAINT "user_roles_granted_by_user_id_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_actor_created_idx" ON "app"."audit_logs" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_target_created_idx" ON "app"."audit_logs" USING btree ("target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX "idempotency_keys_expires_idx" ON "app"."idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "user_roles_role_idx" ON "app"."user_roles" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "users_auth_user_id_unique" ON "app"."users" USING btree ("auth_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_normalized_username_unique" ON "app"."users" USING btree ("normalized_username");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "app"."users" USING btree ("status");--> statement-breakpoint
ALTER TABLE "app"."users"
  ADD CONSTRAINT "users_auth_user_id_auth_users_id_fk"
  FOREIGN KEY ("auth_user_id")
  REFERENCES "auth"."users"("id")
  ON DELETE RESTRICT;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime NOLOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      NOBYPASSRLS;
  END IF;
END
$$;--> statement-breakpoint
ALTER ROLE app_runtime SET search_path = app, pg_catalog;--> statement-breakpoint
REVOKE ALL ON SCHEMA "app" FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA "app" FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT USAGE ON SCHEMA "app" TO app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE
  "app"."users",
  "app"."idempotency_keys"
TO app_runtime;--> statement-breakpoint
GRANT DELETE ON TABLE
  "app"."idempotency_keys"
TO app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON TABLE
  "app"."user_roles"
TO app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE
  "app"."audit_logs"
TO app_runtime;--> statement-breakpoint
ALTER TABLE "app"."users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app"."users" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app"."user_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app"."user_roles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app"."audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app"."audit_logs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app"."idempotency_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app"."idempotency_keys" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "app_runtime_users"
  ON "app"."users"
  FOR ALL
  TO app_runtime
  USING (true)
  WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "app_runtime_user_roles"
  ON "app"."user_roles"
  FOR ALL
  TO app_runtime
  USING (true)
  WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "app_runtime_audit_logs"
  ON "app"."audit_logs"
  FOR ALL
  TO app_runtime
  USING (true)
  WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "app_runtime_idempotency_keys"
  ON "app"."idempotency_keys"
  FOR ALL
  TO app_runtime
  USING (true)
  WITH CHECK (true);
