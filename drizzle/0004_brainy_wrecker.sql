CREATE TABLE "app"."coach_certifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_user_id" uuid NOT NULL,
	"qualification_type" text NOT NULL,
	"storage_path" text NOT NULL,
	"original_filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."profile_photos" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"storage_path" text NOT NULL,
	"original_filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."coach_profiles" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "app"."coach_profiles" ADD COLUMN "certification_submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app"."coach_certifications" ADD CONSTRAINT "coach_certifications_coach_user_id_users_id_fk" FOREIGN KEY ("coach_user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."profile_photos" ADD CONSTRAINT "profile_photos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "coach_certifications_user_qualification_unique" ON "app"."coach_certifications" USING btree ("coach_user_id","qualification_type");--> statement-breakpoint
CREATE UNIQUE INDEX "coach_certifications_storage_path_unique" ON "app"."coach_certifications" USING btree ("storage_path");--> statement-breakpoint
CREATE INDEX "coach_certifications_coach_idx" ON "app"."coach_certifications" USING btree ("coach_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_photos_storage_path_unique" ON "app"."profile_photos" USING btree ("storage_path");--> statement-breakpoint
REVOKE ALL ON TABLE
  "app"."coach_certifications",
  "app"."profile_photos"
FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  "app"."coach_certifications",
  "app"."profile_photos"
TO app_runtime;--> statement-breakpoint
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'coach_certifications',
    'profile_photos'
  ]
  LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON app.%I FOR ALL TO app_runtime USING (true) WITH CHECK (true)',
      'app_runtime_' || table_name,
      table_name
    );
  END LOOP;
END
$$;--> statement-breakpoint
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES
  (
    'profile-photos',
    'profile-photos',
    false,
    512000,
    ARRAY['image/jpeg', 'image/png']
  ),
  (
    'coach-certificates',
    'coach-certificates',
    false,
    1048576,
    ARRAY['application/pdf', 'image/jpeg', 'image/png']
  )
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
