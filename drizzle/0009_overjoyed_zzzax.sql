CREATE TYPE "app"."cycle_payout_status" AS ENUM('available', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "app"."service_cycle_status" AS ENUM('scheduled', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "app"."coach_cycle_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_cycle_id" uuid NOT NULL,
	"purchase_id" uuid NOT NULL,
	"coach_user_id" uuid NOT NULL,
	"amount_paise" integer NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"status" "app"."cycle_payout_status" DEFAULT 'available' NOT NULL,
	"available_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coach_cycle_payouts_amount_valid" CHECK ("app"."coach_cycle_payouts"."amount_paise" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."service_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_id" uuid NOT NULL,
	"assignment_id" uuid NOT NULL,
	"client_user_id" uuid NOT NULL,
	"coach_user_id" uuid,
	"cycle_number" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "app"."service_cycle_status" DEFAULT 'scheduled' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_cycles_number_valid" CHECK ("app"."service_cycles"."cycle_number" between 1 and 3),
	CONSTRAINT "service_cycles_period_valid" CHECK ("app"."service_cycles"."ends_at" > "app"."service_cycles"."starts_at")
);
--> statement-breakpoint
DROP INDEX "app"."replacement_requests_one_open_per_assignment_unique";--> statement-breakpoint
ALTER TABLE "app"."plans" ADD COLUMN "duration_days" integer;--> statement-breakpoint
ALTER TABLE "app"."replacement_requests" ADD COLUMN "desired_coach_user_id" uuid;--> statement-breakpoint
ALTER TABLE "app"."replacement_requests" ADD COLUMN "cycle_number" integer;--> statement-breakpoint
ALTER TABLE "app"."replacement_requests" ADD COLUMN "response_deadline_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app"."replacement_requests" ADD COLUMN "responded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app"."replacement_requests" ADD COLUMN "applied_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app"."coach_cycle_payouts" ADD CONSTRAINT "coach_cycle_payouts_service_cycle_id_service_cycles_id_fk" FOREIGN KEY ("service_cycle_id") REFERENCES "app"."service_cycles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."coach_cycle_payouts" ADD CONSTRAINT "coach_cycle_payouts_purchase_id_plan_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "app"."plan_purchases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."coach_cycle_payouts" ADD CONSTRAINT "coach_cycle_payouts_coach_user_id_users_id_fk" FOREIGN KEY ("coach_user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."service_cycles" ADD CONSTRAINT "service_cycles_purchase_id_plan_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "app"."plan_purchases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."service_cycles" ADD CONSTRAINT "service_cycles_assignment_id_coach_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "app"."coach_assignments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."service_cycles" ADD CONSTRAINT "service_cycles_client_user_id_users_id_fk" FOREIGN KEY ("client_user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."service_cycles" ADD CONSTRAINT "service_cycles_coach_user_id_users_id_fk" FOREIGN KEY ("coach_user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "coach_cycle_payouts_cycle_unique" ON "app"."coach_cycle_payouts" USING btree ("service_cycle_id");--> statement-breakpoint
CREATE INDEX "coach_cycle_payouts_coach_status_idx" ON "app"."coach_cycle_payouts" USING btree ("coach_user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "service_cycles_purchase_number_unique" ON "app"."service_cycles" USING btree ("purchase_id","cycle_number");--> statement-breakpoint
CREATE INDEX "service_cycles_assignment_status_idx" ON "app"."service_cycles" USING btree ("assignment_id","status");--> statement-breakpoint
CREATE INDEX "service_cycles_status_end_idx" ON "app"."service_cycles" USING btree ("status","ends_at");--> statement-breakpoint
ALTER TABLE "app"."replacement_requests" ADD CONSTRAINT "replacement_requests_desired_coach_user_id_users_id_fk" FOREIGN KEY ("desired_coach_user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "replacement_requests_coach_status_deadline_idx" ON "app"."replacement_requests" USING btree ("desired_coach_user_id","status","response_deadline_at");--> statement-breakpoint
CREATE UNIQUE INDEX "replacement_requests_one_open_per_cycle_unique" ON "app"."replacement_requests" USING btree ("assignment_id","cycle_number") WHERE "app"."replacement_requests"."status" in ('requested', 'approved');--> statement-breakpoint
CREATE UNIQUE INDEX "replacement_requests_one_pending_per_client_unique" ON "app"."replacement_requests" USING btree ("requested_by_user_id") WHERE "app"."replacement_requests"."status" = 'requested';--> statement-breakpoint
ALTER TABLE "app"."plans" ADD CONSTRAINT "plans_duration_days_valid" CHECK ("app"."plans"."duration_days" is null or "app"."plans"."duration_days" in (30, 60, 90));--> statement-breakpoint
ALTER TABLE "app"."replacement_requests" ADD CONSTRAINT "replacement_requests_cycle_valid" CHECK ("app"."replacement_requests"."cycle_number" is null or "app"."replacement_requests"."cycle_number" between 1 and 3);--> statement-breakpoint

UPDATE "app"."plans"
SET
  "duration_days" = CASE
    WHEN "duration_months" IN (1, 3) THEN 30
    WHEN "duration_months" IN (2, 6) THEN 60
    WHEN "duration_months" = 12 THEN 90
    ELSE 90
  END,
  "name" = regexp_replace(
    regexp_replace(
      regexp_replace("name", '12[- ]months?', '90-day', 'gi'),
      '6[- ]months?',
      '60-day',
      'gi'
    ),
    '3[- ]months?',
    '30-day',
    'gi'
  ),
  "description" = regexp_replace(
    regexp_replace(
      regexp_replace("description", '12[- ]months?', '90 days', 'gi'),
      '6[- ]months?',
      '60 days',
      'gi'
    ),
    '3[- ]months?',
    '30 days',
    'gi'
  ),
  "features" = regexp_replace(
    "features"::text,
    'monthly',
    'every 30-day cycle',
    'gi'
  )::jsonb,
  "updated_at" = now();--> statement-breakpoint

WITH source_assignments AS (
  SELECT
    purchase."id" AS purchase_id,
    assignment."id" AS assignment_id,
    purchase."client_user_id",
    assignment."coach_user_id",
    purchase."activated_at",
    plan."duration_days",
    generate_series(1, plan."duration_days" / 30) AS cycle_number
  FROM "app"."plan_purchases" AS purchase
  INNER JOIN "app"."plans" AS plan
    ON plan."id" = purchase."plan_id"
  INNER JOIN "app"."coach_assignments" AS assignment
    ON assignment."purchase_id" = purchase."id"
  WHERE purchase."activated_at" IS NOT NULL
    AND assignment."coach_user_id" IS NOT NULL
    AND assignment."status" IN ('assigned', 'ended')
)
INSERT INTO "app"."service_cycles" (
  "purchase_id",
  "assignment_id",
  "client_user_id",
  "coach_user_id",
  "cycle_number",
  "starts_at",
  "ends_at",
  "status",
  "completed_at"
)
SELECT
  source.purchase_id,
  source.assignment_id,
  source.client_user_id,
  CASE
    WHEN source.activated_at + ((source.cycle_number - 1) * interval '720 hours') <= now()
      THEN source.coach_user_id
    ELSE NULL
  END,
  source.cycle_number,
  source.activated_at + ((source.cycle_number - 1) * interval '720 hours'),
  source.activated_at + (source.cycle_number * interval '720 hours'),
  CASE
    WHEN source.activated_at + (source.cycle_number * interval '720 hours') <= now()
      THEN 'completed'::"app"."service_cycle_status"
    WHEN source.activated_at + ((source.cycle_number - 1) * interval '720 hours') <= now()
      THEN 'active'::"app"."service_cycle_status"
    ELSE 'scheduled'::"app"."service_cycle_status"
  END,
  CASE
    WHEN source.activated_at + (source.cycle_number * interval '720 hours') <= now()
      THEN source.activated_at + (source.cycle_number * interval '720 hours')
    ELSE NULL
  END
FROM source_assignments AS source
ON CONFLICT ("purchase_id", "cycle_number") DO NOTHING;--> statement-breakpoint

INSERT INTO "app"."coach_cycle_payouts" (
  "service_cycle_id",
  "purchase_id",
  "coach_user_id",
  "amount_paise",
  "available_at"
)
SELECT
  cycle."id",
  cycle."purchase_id",
  cycle."coach_user_id",
  (
    (
      ((purchase."amount_paise"::bigint * 80) / 100)
      / (plan."duration_days" / 30)
    )
    + CASE
      WHEN cycle."cycle_number" <= (
        ((purchase."amount_paise"::bigint * 80) / 100)
        % (plan."duration_days" / 30)
      )
        THEN 1
      ELSE 0
    END
  )::integer,
  cycle."ends_at"
FROM "app"."service_cycles" AS cycle
INNER JOIN "app"."plan_purchases" AS purchase
  ON purchase."id" = cycle."purchase_id"
INNER JOIN "app"."plans" AS plan
  ON plan."id" = purchase."plan_id"
WHERE cycle."status" = 'completed'
  AND cycle."coach_user_id" IS NOT NULL
ON CONFLICT ("service_cycle_id") DO NOTHING;--> statement-breakpoint

UPDATE "app"."plan_purchases" AS purchase
SET
  "expires_at" = purchase."activated_at" + (plan."duration_days" * interval '24 hours'),
  "status" = CASE
    WHEN purchase."status" = 'active'
      AND purchase."activated_at" + (plan."duration_days" * interval '24 hours') <= now()
      THEN 'completed'::"app"."purchase_status"
    ELSE purchase."status"
  END,
  "updated_at" = now()
FROM "app"."plans" AS plan
WHERE plan."id" = purchase."plan_id"
  AND purchase."activated_at" IS NOT NULL;--> statement-breakpoint

UPDATE "app"."coach_assignments" AS assignment
SET
  "cycle_number" = COALESCE(
    (
      SELECT cycle."cycle_number"
      FROM "app"."service_cycles" AS cycle
      WHERE cycle."assignment_id" = assignment."id"
        AND cycle."status" IN ('active', 'completed')
      ORDER BY
        CASE WHEN cycle."status" = 'active' THEN 0 ELSE 1 END,
        cycle."cycle_number" DESC
      LIMIT 1
    ),
    assignment."cycle_number"
  ),
  "status" = CASE
    WHEN purchase."status" = 'completed'
      THEN 'ended'::"app"."assignment_status"
    ELSE 'assigned'::"app"."assignment_status"
  END,
  "ended_at" = CASE
    WHEN purchase."status" = 'completed' THEN purchase."expires_at"
    ELSE NULL
  END,
  "updated_at" = now()
FROM "app"."plan_purchases" AS purchase
WHERE purchase."id" = assignment."purchase_id"
  AND assignment."status" IN ('assigned', 'ended')
  AND EXISTS (
    SELECT 1
    FROM "app"."service_cycles" AS cycle
    WHERE cycle."assignment_id" = assignment."id"
  );--> statement-breakpoint

INSERT INTO "app"."scheduled_jobs" (
  "job_type",
  "deduplication_key",
  "payload",
  "run_at"
)
SELECT
  'complete_service_cycle',
  'complete-service-cycle:' || cycle."id"::text,
  jsonb_build_object('serviceCycleId', cycle."id"),
  cycle."ends_at"
FROM "app"."service_cycles" AS cycle
WHERE cycle."status" = 'active'
ON CONFLICT ("deduplication_key") DO NOTHING;--> statement-breakpoint

REVOKE ALL ON TABLE
  "app"."service_cycles",
  "app"."coach_cycle_payouts"
FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  "app"."service_cycles",
  "app"."coach_cycle_payouts"
TO app_runtime;--> statement-breakpoint
ALTER TABLE "app"."service_cycles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app"."service_cycles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "app_runtime_service_cycles"
  ON "app"."service_cycles"
  FOR ALL TO app_runtime
  USING (true)
  WITH CHECK (true);--> statement-breakpoint
ALTER TABLE "app"."coach_cycle_payouts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app"."coach_cycle_payouts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "app_runtime_coach_cycle_payouts"
  ON "app"."coach_cycle_payouts"
  FOR ALL TO app_runtime
  USING (true)
  WITH CHECK (true);
