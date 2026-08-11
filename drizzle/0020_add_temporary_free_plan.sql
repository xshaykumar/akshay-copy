-- Temporary testing plan requested for end-to-end client flow verification.
-- Remove it later with a new migration that sets active = false; do not rewrite
-- this applied migration after it has reached a shared environment.
ALTER TABLE "app"."plans" DROP CONSTRAINT IF EXISTS "plans_price_positive";
--> statement-breakpoint
ALTER TABLE "app"."plans" DROP CONSTRAINT IF EXISTS "plans_price_nonnegative";
--> statement-breakpoint
ALTER TABLE "app"."plans" ADD CONSTRAINT "plans_price_nonnegative"
CHECK ("app"."plans"."price_paise" >= 0);
--> statement-breakpoint
INSERT INTO "app"."plans" (
	"code",
	"name",
	"description",
	"coaching_mode",
	"duration_days",
	"price_paise",
	"currency",
	"features",
	"active"
) VALUES (
	'temporary-free-flow-90',
	'Temporary Free Flow Plan',
	'A temporary no-charge plan for testing registration, coach selection, assignment, scheduling, and joining flows.',
	'Online',
	90,
	0,
	'INR',
	'["Complete client-to-coach flow testing", "Coach selection and assignment testing", "Session scheduling and Google Meet join testing", "No payment required"]'::jsonb,
	true
)
ON CONFLICT ("code") DO UPDATE SET
	"name" = EXCLUDED."name",
	"description" = EXCLUDED."description",
	"coaching_mode" = EXCLUDED."coaching_mode",
	"duration_days" = EXCLUDED."duration_days",
	"price_paise" = EXCLUDED."price_paise",
	"currency" = EXCLUDED."currency",
	"features" = EXCLUDED."features",
	"active" = true,
	"updated_at" = now();
