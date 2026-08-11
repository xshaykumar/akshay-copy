ALTER TABLE "app"."plans" DROP CONSTRAINT "plans_duration_days_valid";--> statement-breakpoint
UPDATE "app"."plans"
SET
  "duration_days" = CASE "duration_days"
    WHEN 30 THEN 90
    WHEN 60 THEN 180
    WHEN 90 THEN 365
    ELSE "duration_days"
  END,
  "name" = regexp_replace(
    regexp_replace(
      regexp_replace("name", '90[- ]days?', '12-month', 'gi'),
      '60[- ]days?',
      '6-month',
      'gi'
    ),
    '30[- ]days?',
    '3-month',
    'gi'
  ),
  "description" = regexp_replace(
    regexp_replace(
      regexp_replace("description", '90 days?', '365 days', 'gi'),
      '60 days?',
      '180 days',
      'gi'
    ),
    '30 days?',
    '90 days',
    'gi'
  ),
  "updated_at" = now();--> statement-breakpoint
UPDATE "app"."plan_purchases" AS purchase
SET
  "expires_at" = purchase."activated_at" + (plan."duration_days" * interval '24 hours'),
  "updated_at" = now()
FROM "app"."plans" AS plan
WHERE purchase."plan_id" = plan."id"
  AND purchase."activated_at" IS NOT NULL
  AND purchase."status" = 'active';--> statement-breakpoint
ALTER TABLE "app"."plans" ADD CONSTRAINT "plans_duration_days_valid" CHECK ("app"."plans"."duration_days" in (90, 180, 365));
