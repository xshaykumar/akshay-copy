ALTER TABLE "app"."replacement_requests" DROP CONSTRAINT "replacement_requests_cycle_valid";--> statement-breakpoint
ALTER TABLE "app"."service_cycles" DROP CONSTRAINT "service_cycles_number_valid";--> statement-breakpoint
ALTER TABLE "app"."replacement_requests" ADD CONSTRAINT "replacement_requests_cycle_valid" CHECK ("app"."replacement_requests"."cycle_number" is null or "app"."replacement_requests"."cycle_number" between 1 and 12);--> statement-breakpoint
ALTER TABLE "app"."service_cycles" ADD CONSTRAINT "service_cycles_number_valid" CHECK ("app"."service_cycles"."cycle_number" between 1 and 12);--> statement-breakpoint
WITH expanded_cycles AS (
  SELECT
    purchase."id" AS purchase_id,
    assignment."id" AS assignment_id,
    purchase."client_user_id",
    purchase."activated_at",
    plan."duration_days",
    generate_series(
      1,
      CASE plan."duration_days"
        WHEN 90 THEN 3
        WHEN 180 THEN 6
        WHEN 365 THEN 12
      END
    ) AS cycle_number
  FROM "app"."plan_purchases" AS purchase
  INNER JOIN "app"."plans" AS plan ON plan."id" = purchase."plan_id"
  INNER JOIN "app"."coach_assignments" AS assignment ON assignment."purchase_id" = purchase."id"
  WHERE purchase."status" = 'active'
    AND purchase."activated_at" IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM "app"."service_cycles" AS existing
      WHERE existing."purchase_id" = purchase."id"
    )
)
INSERT INTO "app"."service_cycles" (
  "purchase_id",
  "assignment_id",
  "client_user_id",
  "coach_user_id",
  "cycle_number",
  "starts_at",
  "ends_at",
  "status"
)
SELECT
  expanded."purchase_id",
  expanded."assignment_id",
  expanded."client_user_id",
  NULL,
  expanded."cycle_number",
  expanded."activated_at" + ((expanded."cycle_number" - 1) * interval '30 days'),
  CASE
    WHEN expanded."cycle_number" = CASE expanded."duration_days"
      WHEN 90 THEN 3
      WHEN 180 THEN 6
      WHEN 365 THEN 12
    END
      THEN expanded."activated_at" + (expanded."duration_days" * interval '24 hours')
    ELSE expanded."activated_at" + (expanded."cycle_number" * interval '30 days')
  END,
  'scheduled'::"app"."service_cycle_status"
FROM expanded_cycles AS expanded
ON CONFLICT ("purchase_id", "cycle_number") DO NOTHING;
