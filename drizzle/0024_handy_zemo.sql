DROP INDEX "app"."coach_profiles_activation_availability_idx";--> statement-breakpoint
ALTER TABLE "app"."coach_profiles" ADD COLUMN "certification_waived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app"."coach_profiles" ADD COLUMN "certification_waived_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "app"."coach_profiles" ADD CONSTRAINT "coach_profiles_certification_waived_by_user_id_users_id_fk" FOREIGN KEY ("certification_waived_by_user_id") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coach_profiles_activation_availability_idx" ON "app"."coach_profiles" USING btree ("approved_at","certification_waived_at","activation_expires_at","accepting_clients");