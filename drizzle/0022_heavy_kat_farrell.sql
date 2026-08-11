CREATE TABLE "app"."coaching_group_members" (
	"group_id" uuid NOT NULL,
	"assignment_id" uuid NOT NULL,
	"client_user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coaching_group_members_group_assignment_pk" PRIMARY KEY("group_id","assignment_id")
);
--> statement-breakpoint
CREATE TABLE "app"."coaching_group_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"coach_user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "app"."session_status" DEFAULT 'scheduled' NOT NULL,
	"meeting_provider" text DEFAULT 'google_meet' NOT NULL,
	"provider_room_id" text NOT NULL,
	"rescheduled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coaching_group_sessions_period_valid" CHECK ("app"."coaching_group_sessions"."ends_at" > "app"."coaching_group_sessions"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "app"."coaching_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coaching_groups_name_length" CHECK (char_length(trim("app"."coaching_groups"."name")) between 2 and 80)
);
--> statement-breakpoint
ALTER TABLE "app"."coaching_group_members" ADD CONSTRAINT "coaching_group_members_group_id_coaching_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "app"."coaching_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."coaching_group_members" ADD CONSTRAINT "coaching_group_members_assignment_id_coach_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "app"."coach_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."coaching_group_members" ADD CONSTRAINT "coaching_group_members_client_user_id_users_id_fk" FOREIGN KEY ("client_user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."coaching_group_sessions" ADD CONSTRAINT "coaching_group_sessions_group_id_coaching_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "app"."coaching_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."coaching_group_sessions" ADD CONSTRAINT "coaching_group_sessions_coach_user_id_users_id_fk" FOREIGN KEY ("coach_user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."coaching_groups" ADD CONSTRAINT "coaching_groups_coach_user_id_users_id_fk" FOREIGN KEY ("coach_user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "coaching_group_members_assignment_unique" ON "app"."coaching_group_members" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "coaching_group_members_client_idx" ON "app"."coaching_group_members" USING btree ("client_user_id");--> statement-breakpoint
CREATE INDEX "coaching_group_sessions_group_start_idx" ON "app"."coaching_group_sessions" USING btree ("group_id","starts_at");--> statement-breakpoint
CREATE INDEX "coaching_group_sessions_coach_start_idx" ON "app"."coaching_group_sessions" USING btree ("coach_user_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "coaching_group_sessions_provider_room_unique" ON "app"."coaching_group_sessions" USING btree ("meeting_provider","provider_room_id");--> statement-breakpoint
CREATE INDEX "coaching_groups_coach_idx" ON "app"."coaching_groups" USING btree ("coach_user_id");--> statement-breakpoint

CREATE OR REPLACE FUNCTION app.validate_coaching_group_member()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = app, pg_temp
AS $$
DECLARE
  group_coach_user_id uuid;
  eligible_client_user_id uuid;
  active_member_count integer;
BEGIN
  SELECT coach_user_id
  INTO group_coach_user_id
  FROM app.coaching_groups
  WHERE id = NEW.group_id
  FOR UPDATE;

  IF group_coach_user_id IS NULL THEN
    RAISE EXCEPTION 'Group not found';
  END IF;

  SELECT assignment.client_user_id
  INTO eligible_client_user_id
  FROM app.coach_assignments AS assignment
  INNER JOIN app.plan_purchases AS purchase
    ON purchase.id = assignment.purchase_id
  INNER JOIN app.plans AS plan
    ON plan.id = purchase.plan_id
  WHERE assignment.id = NEW.assignment_id
    AND assignment.status = 'assigned'
    AND assignment.coach_user_id = group_coach_user_id
    AND assignment.client_user_id = NEW.client_user_id
    AND purchase.client_user_id = NEW.client_user_id
    AND purchase.status = 'active'
    AND purchase.expires_at > now()
    AND plan.code LIKE 'group-online-coaching-%';

  IF eligible_client_user_id IS NULL THEN
    RAISE EXCEPTION 'Client is not eligible for this coaching group';
  END IF;

  SELECT count(*)
  INTO active_member_count
  FROM app.coaching_group_members
  WHERE group_id = NEW.group_id
    AND (TG_OP <> 'UPDATE' OR assignment_id <> OLD.assignment_id);

  IF active_member_count >= 20 THEN
    RAISE EXCEPTION 'A coaching group cannot contain more than 20 members';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER coaching_group_members_validate
BEFORE INSERT OR UPDATE ON app.coaching_group_members
FOR EACH ROW EXECUTE FUNCTION app.validate_coaching_group_member();--> statement-breakpoint

CREATE OR REPLACE FUNCTION app.validate_coaching_group_session()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = app, pg_temp
AS $$
BEGIN
  IF NEW.status = 'cancelled' THEN
    RAISE EXCEPTION 'Group sessions cannot be cancelled';
  END IF;

  IF NEW.meeting_provider <> 'google_meet' THEN
    RAISE EXCEPTION 'Group sessions require Google Meet';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM app.coaching_groups
    WHERE id = NEW.group_id
      AND coach_user_id = NEW.coach_user_id
  ) THEN
    RAISE EXCEPTION 'Session coach must own the coaching group';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER coaching_group_sessions_validate
BEFORE INSERT OR UPDATE ON app.coaching_group_sessions
FOR EACH ROW EXECUTE FUNCTION app.validate_coaching_group_session();--> statement-breakpoint

REVOKE ALL ON TABLE
  "app"."coaching_groups",
  "app"."coaching_group_members",
  "app"."coaching_group_sessions"
FROM PUBLIC, anon, authenticated;--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  "app"."coaching_groups",
  "app"."coaching_group_members",
  "app"."coaching_group_sessions"
TO app_runtime;--> statement-breakpoint

ALTER TABLE "app"."coaching_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app"."coaching_groups" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "app_runtime_coaching_groups"
  ON "app"."coaching_groups"
  FOR ALL TO app_runtime
  USING (true)
  WITH CHECK (true);--> statement-breakpoint

ALTER TABLE "app"."coaching_group_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app"."coaching_group_members" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "app_runtime_coaching_group_members"
  ON "app"."coaching_group_members"
  FOR ALL TO app_runtime
  USING (true)
  WITH CHECK (true);--> statement-breakpoint

ALTER TABLE "app"."coaching_group_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app"."coaching_group_sessions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "app_runtime_coaching_group_sessions"
  ON "app"."coaching_group_sessions"
  FOR ALL TO app_runtime
  USING (true)
  WITH CHECK (true);
