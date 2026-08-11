CREATE TABLE "app"."coach_selection_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"client_user_id" uuid NOT NULL,
	"coach_user_id" uuid NOT NULL,
	"selection_round" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coach_selection_requests_round_valid" CHECK ("app"."coach_selection_requests"."selection_round" > 0),
	CONSTRAINT "coach_selection_requests_status_valid" CHECK ("app"."coach_selection_requests"."status" in ('pending', 'accepted', 'rejected', 'expired', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "app"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"action_url" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."coach_selection_requests" ADD CONSTRAINT "coach_selection_requests_assignment_id_coach_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "app"."coach_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."coach_selection_requests" ADD CONSTRAINT "coach_selection_requests_client_user_id_users_id_fk" FOREIGN KEY ("client_user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."coach_selection_requests" ADD CONSTRAINT "coach_selection_requests_coach_user_id_users_id_fk" FOREIGN KEY ("coach_user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "coach_selection_requests_coach_round_unique" ON "app"."coach_selection_requests" USING btree ("assignment_id","coach_user_id","selection_round");--> statement-breakpoint
CREATE INDEX "coach_selection_requests_assignment_round_status_idx" ON "app"."coach_selection_requests" USING btree ("assignment_id","selection_round","status");--> statement-breakpoint
CREATE INDEX "coach_selection_requests_coach_status_expiry_idx" ON "app"."coach_selection_requests" USING btree ("coach_user_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "notifications_user_read_created_idx" ON "app"."notifications" USING btree ("user_id","read_at","created_at");--> statement-breakpoint
REVOKE ALL ON TABLE
  "app"."coach_selection_requests",
  "app"."notifications"
FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  "app"."coach_selection_requests",
  "app"."notifications"
TO app_runtime;--> statement-breakpoint
ALTER TABLE "app"."coach_selection_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app"."coach_selection_requests" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "app_runtime_coach_selection_requests"
  ON "app"."coach_selection_requests"
  FOR ALL TO app_runtime
  USING (true)
  WITH CHECK (true);--> statement-breakpoint
ALTER TABLE "app"."notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app"."notifications" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "app_runtime_notifications"
  ON "app"."notifications"
  FOR ALL TO app_runtime
  USING (true)
  WITH CHECK (true);
