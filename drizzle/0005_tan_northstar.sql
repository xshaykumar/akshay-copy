CREATE TYPE "app"."coach_certification_status" AS ENUM('draft', 'submitted', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "app"."coach_activation_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_user_id" uuid NOT NULL,
	"provider" text DEFAULT 'testing' NOT NULL,
	"provider_reference" text,
	"amount_paise" integer NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"status" "app"."payment_status" DEFAULT 'captured' NOT NULL,
	"period_starts_at" timestamp with time zone NOT NULL,
	"period_ends_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."coach_certifications" ADD COLUMN "verification_status" "app"."coach_certification_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."coach_certifications" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app"."coach_certifications" ADD COLUMN "reviewed_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "app"."coach_profiles" ADD COLUMN "certification_review_message" text;--> statement-breakpoint
ALTER TABLE "app"."coach_profiles" ADD COLUMN "available_days" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."coach_profiles" ADD COLUMN "available_time_slots" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."coach_profiles" ADD COLUMN "location_state" text;--> statement-breakpoint
ALTER TABLE "app"."coach_profiles" ADD COLUMN "location_city" text;--> statement-breakpoint
ALTER TABLE "app"."coach_profiles" ADD COLUMN "location_district" text;--> statement-breakpoint
ALTER TABLE "app"."coach_profiles" ADD COLUMN "activation_expires_at" timestamp with time zone;--> statement-breakpoint
UPDATE "app"."coach_certifications" AS certifications
SET
	"verification_status" = CASE profiles."approval_status"::text
		WHEN 'approved' THEN 'approved'::"app"."coach_certification_status"
		WHEN 'submitted' THEN 'submitted'::"app"."coach_certification_status"
		WHEN 'rejected' THEN 'rejected'::"app"."coach_certification_status"
		ELSE 'draft'::"app"."coach_certification_status"
	END,
	"reviewed_at" = CASE
		WHEN profiles."approval_status"::text = 'approved' THEN profiles."approved_at"
		ELSE NULL
	END,
	"reviewed_by_user_id" = CASE
		WHEN profiles."approval_status"::text = 'approved' THEN profiles."approved_by_user_id"
		ELSE NULL
	END
FROM "app"."coach_profiles" AS profiles
WHERE profiles."user_id" = certifications."coach_user_id";--> statement-breakpoint
UPDATE "app"."coach_profiles"
SET "certification_review_message" = 'Thank you for your submission. Welcome to 360 Performance. Please fill in your activation details to get your account activated.'
WHERE "approval_status"::text = 'approved'
  AND "certification_review_message" IS NULL;--> statement-breakpoint
ALTER TABLE "app"."coach_activation_payments" ADD CONSTRAINT "coach_activation_payments_coach_user_id_users_id_fk" FOREIGN KEY ("coach_user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "coach_activation_payments_provider_reference_unique" ON "app"."coach_activation_payments" USING btree ("provider","provider_reference");--> statement-breakpoint
CREATE INDEX "coach_activation_payments_coach_period_idx" ON "app"."coach_activation_payments" USING btree ("coach_user_id","period_ends_at");--> statement-breakpoint
ALTER TABLE "app"."coach_certifications" ADD CONSTRAINT "coach_certifications_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coach_profiles_activation_availability_idx" ON "app"."coach_profiles" USING btree ("approved_at","activation_expires_at","accepting_clients");--> statement-breakpoint
ALTER TABLE "app"."coach_profiles" ADD CONSTRAINT "coach_profiles_available_days_valid" CHECK (
	"available_days" <@ ARRAY['monday','tuesday','wednesday','thursday','friday','saturday','sunday']::text[]
);--> statement-breakpoint
ALTER TABLE "app"."coach_profiles" ADD CONSTRAINT "coach_profiles_available_time_slots_valid" CHECK (
	"available_time_slots" <@ ARRAY['09:00-12:00','13:00-16:00','17:00-20:00']::text[]
);--> statement-breakpoint
ALTER TABLE "app"."coach_activation_payments" ADD CONSTRAINT "coach_activation_payments_amount_positive" CHECK ("amount_paise" > 0);--> statement-breakpoint
ALTER TABLE "app"."coach_activation_payments" ADD CONSTRAINT "coach_activation_payments_period_valid" CHECK ("period_ends_at" > "period_starts_at");--> statement-breakpoint
REVOKE ALL ON TABLE "app"."coach_activation_payments" FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "app"."coach_activation_payments" TO app_runtime;--> statement-breakpoint
ALTER TABLE "app"."coach_activation_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app"."coach_activation_payments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "app_runtime_coach_activation_payments" ON "app"."coach_activation_payments"
FOR ALL TO app_runtime USING (true) WITH CHECK (true);
