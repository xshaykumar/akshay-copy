ALTER TABLE "app"."coach_assignments" ADD COLUMN "application_window_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app"."coach_assignments" ADD COLUMN "cycle_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."coach_assignments" ADD COLUMN "refund_eligible_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "coach_assignments_selection_deadline_idx" ON "app"."coach_assignments" USING btree ("status","selection_window_ends_at");--> statement-breakpoint
CREATE INDEX "coach_assignments_application_deadline_idx" ON "app"."coach_assignments" USING btree ("status","application_window_ends_at");